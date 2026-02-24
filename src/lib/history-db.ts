/**
 * history-db.ts
 * @tauri-apps/plugin-sql を使用した SQLite 履歴 DB の初期化
 */

import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;

export async function getHistoryDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:history.db');
  await initSchema(_db);
  return _db;
}

async function initSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS files (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT    UNIQUE NOT NULL,
      is_alive  INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id      INTEGER NOT NULL,
      parent_id    INTEGER,
      content_hash TEXT    NOT NULL,
      char_count   INTEGER NOT NULL DEFAULT 0,
      change_delta INTEGER NOT NULL DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id)   REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES snapshots(id) ON DELETE SET NULL,
      UNIQUE (file_id, content_hash)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS snapshot_blobs (
      content_hash TEXT    PRIMARY KEY,
      content      TEXT    NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_file ON snapshots(file_id)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC)
  `);
}
