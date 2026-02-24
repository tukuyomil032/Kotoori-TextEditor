/**
 * history-manager.ts
 * Electron の HistoryManager を @tauri-apps/plugin-sql で再実装
 */

import * as Diff from 'diff';
import { getHistoryDb } from './history-db';

// ─── 型定義 ────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: number;
  file_path: string;
  is_alive: number;
  created_at: string;
  updated_at: string;
}

export interface SnapshotRecord {
  id: number;
  file_id: number;
  parent_id: number | null;
  content_hash: string;
  char_count: number;
  change_delta: number;
  created_at: string;
}

export interface DiffResult {
  added: number;
  removed: number;
  changes: Diff.Change[];
}

const MAX_SNAPSHOTS = 100;

// ─── SHA-256 ハッシュ（Web Crypto API） ────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── HistoryManager ────────────────────────────────────────────────────────────

/** スナップショットを保存する。内容が変わっていない場合は null を返す */
export async function saveSnapshot(
  filePath: string,
  content: string
): Promise<SnapshotRecord | null> {
  const db = await getHistoryDb();
  const hash = await sha256(content);
  const charCount = content.length;

  // files テーブルの確認・挿入
  const rows = await db.select<FileRecord[]>('SELECT id FROM files WHERE file_path = ?', [
    filePath,
  ]);
  let fileId: number;
  if (rows.length === 0) {
    const res = await db.execute('INSERT INTO files (file_path) VALUES (?)', [filePath]);
    fileId = res.lastInsertId ?? 0;
  } else {
    fileId = rows[0].id;
    await db.execute('UPDATE files SET is_alive = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      fileId,
    ]);
  }

  // 最新スナップショットと同一ならスキップ
  const latestRows = await db.select<SnapshotRecord[]>(
    'SELECT id, content_hash, char_count FROM snapshots WHERE file_id = ? ORDER BY created_at DESC LIMIT 1',
    [fileId]
  );
  const latest = latestRows[0] ?? null;
  if (latest && latest.content_hash === hash) return null;

  const changeDelta = latest ? charCount - latest.char_count : charCount;

  // コンテンツ本体を保存 (重複排除)
  const blobRows = await db.select<{ content_hash: string }[]>(
    'SELECT content_hash FROM snapshot_blobs WHERE content_hash = ?',
    [hash]
  );
  if (blobRows.length === 0) {
    await db.execute('INSERT INTO snapshot_blobs (content_hash, content) VALUES (?, ?)', [
      hash,
      content,
    ]);
  }

  // スナップショット挿入
  const parentId = latest?.id ?? null;
  const insertRes = await db.execute(
    `INSERT OR IGNORE INTO snapshots (file_id, parent_id, content_hash, char_count, change_delta)
     VALUES (?, ?, ?, ?, ?)`,
    [fileId, parentId, hash, charCount, changeDelta]
  );

  // ローテーション
  await rotateSnapshots(fileId);

  const inserted = await db.select<SnapshotRecord[]>('SELECT * FROM snapshots WHERE id = ?', [
    insertRes.lastInsertId,
  ]);
  return inserted[0] ?? null;
}

/** ファイルのスナップショット履歴を新しい順で返す */
export async function getHistory(filePath: string): Promise<SnapshotRecord[]> {
  const db = await getHistoryDb();
  const fileRows = await db.select<{ id: number }[]>('SELECT id FROM files WHERE file_path = ?', [
    filePath,
  ]);
  if (fileRows.length === 0) return [];
  return db.select<SnapshotRecord[]>(
    'SELECT * FROM snapshots WHERE file_id = ? ORDER BY created_at DESC',
    [fileRows[0].id]
  );
}

/** スナップショット ID に対応するコンテンツを返す */
export async function getSnapshotContent(hash: string): Promise<string | null> {
  const db = await getHistoryDb();
  const rows = await db.select<{ content: string }[]>(
    'SELECT content FROM snapshot_blobs WHERE content_hash = ?',
    [hash]
  );
  return rows[0]?.content ?? null;
}

/** 2 つのスナップショット間の差分を返す */
export async function getSnapshotDiff(oldId: number, newId: number): Promise<DiffResult> {
  const db = await getHistoryDb();
  const [oldRow, newRow] = await Promise.all([
    db.select<SnapshotRecord[]>('SELECT * FROM snapshots WHERE id = ?', [oldId]),
    db.select<SnapshotRecord[]>('SELECT * FROM snapshots WHERE id = ?', [newId]),
  ]);
  if (!oldRow[0] || !newRow[0]) return { added: 0, removed: 0, changes: [] };

  const [oldContent, newContent] = await Promise.all([
    getSnapshotContent(oldRow[0].content_hash),
    getSnapshotContent(newRow[0].content_hash),
  ]);
  if (oldContent === null || newContent === null) {
    return { added: 0, removed: 0, changes: [] };
  }

  const changes = Diff.diffChars(oldContent, newContent);
  const added = changes.filter((c) => c.added).reduce((a, c) => a + (c.count ?? 0), 0);
  const removed = changes.filter((c) => c.removed).reduce((a, c) => a + (c.count ?? 0), 0);
  return { added, removed, changes };
}

/** 全ファイル一覧（生存チェック付き）を返す */
export async function getAllFiles(): Promise<FileRecord[]> {
  const db = await getHistoryDb();
  return db.select<FileRecord[]>('SELECT * FROM files ORDER BY updated_at DESC');
}

/** ファイルの is_alive を確認・更新する */
export async function checkLiveness(): Promise<void> {
  const db = await getHistoryDb();
  const files = await db.select<FileRecord[]>('SELECT id, file_path FROM files WHERE is_alive = 1');
  const { exists } = await import('@tauri-apps/plugin-fs');
  for (const file of files) {
    try {
      const alive = await exists(file.file_path);
      if (!alive) {
        await db.execute(
          'UPDATE files SET is_alive = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [file.id]
        );
      }
    } catch {
      // ignore
    }
  }
}

/** ファイルの履歴をすべて削除する */
export async function deleteFileHistory(fileId: number): Promise<void> {
  const db = await getHistoryDb();
  // スナップショットを取得して孤児ブロブを削除
  const snapshots = await db.select<SnapshotRecord[]>(
    'SELECT content_hash FROM snapshots WHERE file_id = ?',
    [fileId]
  );
  await db.execute('DELETE FROM snapshots WHERE file_id = ?', [fileId]);
  await db.execute('DELETE FROM files WHERE id = ?', [fileId]);
  // 参照されなくなったブロブを削除
  for (const snap of snapshots) {
    const refs = await db.select<{ c: number }[]>(
      'SELECT count(*) as c FROM snapshots WHERE content_hash = ?',
      [snap.content_hash]
    );
    if ((refs[0]?.c ?? 0) === 0) {
      await db.execute('DELETE FROM snapshot_blobs WHERE content_hash = ?', [snap.content_hash]);
    }
  }
}

// ─── private ───────────────────────────────────────────────────────────────────

async function rotateSnapshots(fileId: number): Promise<void> {
  const db = await getHistoryDb();
  const countRows = await db.select<{ c: number }[]>(
    'SELECT count(*) as c FROM snapshots WHERE file_id = ?',
    [fileId]
  );
  const count = countRows[0]?.c ?? 0;
  if (count <= MAX_SNAPSHOTS) return;

  const excess = count - MAX_SNAPSHOTS;
  const oldest = await db.select<SnapshotRecord[]>(
    'SELECT id, content_hash FROM snapshots WHERE file_id = ? ORDER BY created_at ASC LIMIT ?',
    [fileId, excess]
  );
  for (const snap of oldest) {
    await db.execute('DELETE FROM snapshots WHERE id = ?', [snap.id]);
    const refs = await db.select<{ c: number }[]>(
      'SELECT count(*) as c FROM snapshots WHERE content_hash = ?',
      [snap.content_hash]
    );
    if ((refs[0]?.c ?? 0) === 0) {
      await db.execute('DELETE FROM snapshot_blobs WHERE content_hash = ?', [snap.content_hash]);
    }
  }
}
