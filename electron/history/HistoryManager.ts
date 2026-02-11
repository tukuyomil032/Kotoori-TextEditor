import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as Diff from 'diff';

export interface FileRecord {
    id: number;
    path: string;
    is_alive: number;
    lost_at?: string;
}

export interface SnapshotRecord {
    id: number;
    file_id: number;
    parent_id: number | null;
    created_at: string;
    hash: string;
    char_count: number;
    change_delta: number;
}

export interface DiffResult {
    added: number;
    removed: number;
    changes: any[];
}

export class HistoryManager {
    private db: Database.Database;
    private blobDir: string;

    constructor(dbPath: string, blobDir: string) {
        this.blobDir = blobDir;
        if (!fs.existsSync(this.blobDir)) {
            fs.mkdirSync(this.blobDir, { recursive: true });
        }
        this.db = new Database(dbPath);
        this.initSchema();
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE,
                is_alive INTEGER DEFAULT 1,
                lost_at DATETIME
            );
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER,
                parent_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                hash TEXT,
                char_count INTEGER,
                change_delta INTEGER,
                FOREIGN KEY(file_id) REFERENCES files(id)
            );
            CREATE INDEX IF NOT EXISTS idx_snapshots_file ON snapshots(file_id);
        `);

        // Migration for existing databases
        const filesInfo = this.db.prepare("PRAGMA table_info(files)").all() as { name: string }[];
        const filesColumns = filesInfo.map(info => info.name);

        if (!filesColumns.includes('is_alive')) {
            this.db.exec("ALTER TABLE files ADD COLUMN is_alive INTEGER DEFAULT 1");
        }
        if (!filesColumns.includes('lost_at')) {
            this.db.exec("ALTER TABLE files ADD COLUMN lost_at DATETIME");
        }

        const snapshotsInfo = this.db.prepare("PRAGMA table_info(snapshots)").all() as { name: string }[];
        const snapshotsColumns = snapshotsInfo.map(info => info.name);

        if (!snapshotsColumns.includes('created_at')) {
            this.db.exec("ALTER TABLE snapshots ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!snapshotsColumns.includes('hash')) {
            this.db.exec("ALTER TABLE snapshots ADD COLUMN hash TEXT");
        }
        if (!snapshotsColumns.includes('char_count')) {
            this.db.exec("ALTER TABLE snapshots ADD COLUMN char_count INTEGER");
        }
        if (!snapshotsColumns.includes('change_delta')) {
            this.db.exec("ALTER TABLE snapshots ADD COLUMN change_delta INTEGER");
        }
        if (!snapshotsColumns.includes('parent_id')) {
            this.db.exec("ALTER TABLE snapshots ADD COLUMN parent_id INTEGER");
        }
    }

    public saveSnapshot(filePath: string, content: string): SnapshotRecord | null {
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const charCount = content.length;

        let file = this.db.prepare('SELECT id FROM files WHERE path = ?').get(filePath) as { id: number } | undefined;
        if (!file) {
            const result = this.db.prepare('INSERT INTO files (path) VALUES (?)').run(filePath);
            file = { id: result.lastInsertRowid as number };
        }

        const latest = this.db.prepare('SELECT id, hash, char_count FROM snapshots WHERE file_id = ? ORDER BY created_at DESC LIMIT 1').get(file.id) as { id: number, hash: string, char_count: number } | undefined;

        if (latest && latest.hash === hash) {
            console.log('HistoryManager: Content hash unchanged, skipping snapshot.');
            return null;
        }

        const changeDelta = latest ? charCount - latest.char_count : charCount;
        const blobPath = path.join(this.blobDir, hash);
        if (!fs.existsSync(blobPath)) {
            fs.writeFileSync(blobPath, content);
        }

        const result = this.db.prepare(`
            INSERT INTO snapshots (file_id, parent_id, hash, char_count, change_delta)
            VALUES (?, ?, ?, ?, ?)
        `).run(file.id, latest ? latest.id : null, hash, charCount, changeDelta);

        this.rotateSnapshots(file.id);

        console.log('HistoryManager: Saved snapshot for', filePath);
        return this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(result.lastInsertRowid) as SnapshotRecord;
    }

    private rotateSnapshots(fileId: number) {
        const count = this.db.prepare('SELECT count(*) as count FROM snapshots WHERE file_id = ?').get(fileId) as { count: number };
        if (count.count > 100) {
            const oldest = this.db.prepare('SELECT id, hash FROM snapshots WHERE file_id = ? ORDER BY created_at ASC LIMIT ?').all(fileId, count.count - 100) as { id: number, hash: string }[];
            for (const snap of oldest) {
                this.db.prepare('DELETE FROM snapshots WHERE id = ?').run(snap.id);
                const stillUsed = this.db.prepare('SELECT count(*) as count FROM snapshots WHERE hash = ?').get(snap.hash) as { count: number };
                if (stillUsed.count === 0) {
                    const blobPath = path.join(this.blobDir, snap.hash);
                    if (fs.existsSync(blobPath)) fs.unlinkSync(blobPath);
                }
            }
        }
    }

    public getHistory(filePath: string): SnapshotRecord[] {
        const file = this.db.prepare('SELECT id FROM files WHERE path = ?').get(filePath) as { id: number } | undefined;
        if (!file) return [];
        return this.db.prepare('SELECT * FROM snapshots WHERE file_id = ? ORDER BY created_at DESC').all(file.id) as SnapshotRecord[];
    }

    public getSnapshotContent(hash: string): string | null {
        const blobPath = path.join(this.blobDir, hash);
        if (fs.existsSync(blobPath)) {
            return fs.readFileSync(blobPath, 'utf-8');
        }
        return null;
    }

    public getAllFiles(): FileRecord[] {
        return this.db.prepare('SELECT * FROM files ORDER BY path ASC').all() as FileRecord[];
    }

    public checkLiveness() {
        const files = this.db.prepare('SELECT id, path, is_alive FROM files').all() as FileRecord[];
        this.db.transaction(() => {
            for (const file of files) {
                const exists = fs.existsSync(file.path);
                if (exists && file.is_alive === 0) {
                    this.db.prepare('UPDATE files SET is_alive = 1, lost_at = NULL WHERE id = ?').run(file.id);
                } else if (!exists && file.is_alive === 1) {
                    this.db.prepare("UPDATE files SET is_alive = 0, lost_at = datetime('now') WHERE id = ?").run(file.id);
                }
            }
        })();
    }

    public getDiff(oldSnapshotId: number, newSnapshotId: number): DiffResult {
        const oldSnap = this.db.prepare('SELECT hash FROM snapshots WHERE id = ?').get(oldSnapshotId) as { hash: string } | undefined;
        const newSnap = this.db.prepare('SELECT hash FROM snapshots WHERE id = ?').get(newSnapshotId) as { hash: string } | undefined;
        const oldContent = oldSnap ? (this.getSnapshotContent(oldSnap.hash) || '') : '';
        const newContent = newSnap ? (this.getSnapshotContent(newSnap.hash) || '') : '';
        const changes = Diff.diffLines(oldContent, newContent);
        let added = 0, removed = 0;
        changes.forEach((part: any) => {
            if (part.added) added += (part.count || 0);
            if (part.removed) removed += (part.count || 0);
        });
        return { added, removed, changes };
    }

    public deleteFileHistory(fileId: number) {
        const snapshots = this.db.prepare('SELECT hash FROM snapshots WHERE file_id = ?').all(fileId) as { hash: string }[];

        this.db.transaction(() => {
            this.db.prepare('DELETE FROM snapshots WHERE file_id = ?').run(fileId);
            this.db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
        })();

        // Clean up blobs
        for (const snap of snapshots) {
            const stillUsed = this.db.prepare('SELECT count(*) as count FROM snapshots WHERE hash = ?').get(snap.hash) as { count: number };
            if (stillUsed.count === 0) {
                const blobPath = path.join(this.blobDir, snap.hash);
                if (fs.existsSync(blobPath)) {
                    fs.unlinkSync(blobPath);
                }
            }
        }
    }
}
