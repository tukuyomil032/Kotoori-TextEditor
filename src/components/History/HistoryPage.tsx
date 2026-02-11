import React, { useEffect, useState } from 'react';
import './History.css';
import { format } from 'date-fns';
import BackButton from '../BackButton';

interface FileRecord { id: number; path: string; is_alive: number; lost_at?: string; }
interface SnapshotRecord { id: number; file_id: number; created_at: string; char_count: number; change_delta: number; hash: string; }
interface DiffResult { added: number; removed: number; changes: any[]; }

interface HistoryPageProps {
    currentPath: string | undefined;
    onRestore: (content: string) => void;
    onBack: () => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ currentPath, onRestore, onBack }) => {
    const [files, setFiles] = useState<FileRecord[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
    const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotRecord | null>(null);
    const [diff, setDiff] = useState<DiffResult | null>(null);

    useEffect(() => { loadFiles(); }, []);
    const loadFiles = async () => {
        const list = await window.electronAPI.getHistoryFiles();
        setFiles(list);
        if (currentPath) {
            const current = list.find(f => f.path === currentPath);
            if (current) handleSelectFile(current);
        }
    };
    const handleSelectFile = async (file: FileRecord) => {
        setSelectedFile(file); setSelectedSnapshot(null); setDiff(null);
        const snaps = await window.electronAPI.getHistorySnapshots(file.path);
        setSnapshots(snaps);
    };
    const handleDeleteFile = async (e: React.MouseEvent, file: FileRecord) => {
        e.stopPropagation();
        if (!window.confirm(`「${file.path.split(/[\\/]/).pop()}」の履歴を完全に削除しますか？\n(実ファイルは削除されません)`)) return;
        await window.electronAPI.deleteHistoryFile(file.id);
        if (selectedFile?.id === file.id) {
            setSelectedFile(null);
            setSnapshots([]);
            setSelectedSnapshot(null);
            setDiff(null);
        }
        loadFiles();
    };
    const handleSelectSnapshot = async (snap: SnapshotRecord) => {
        setSelectedSnapshot(snap);
        const index = snapshots.findIndex(s => s.id === snap.id);
        const parent = (index !== -1 && index < snapshots.length - 1) ? snapshots[index + 1] : null;
        try {
            if (parent) { const res = await window.electronAPI.getSnapshotDiff(parent.id, snap.id); setDiff(res); }
            else {
                const content = await window.electronAPI.getSnapshotContent(snap.hash);
                if (content !== null) setDiff({ added: content.split('\n').length, removed: 0, changes: [{ value: content, added: true }] });
                else setDiff(null);
            }
        } catch (e) { setDiff(null); }
    };
    const handleRestoreOverwrite = async () => {
        if (!selectedFile || !selectedSnapshot) return;

        const isCurrent = currentPath === selectedFile.path;
        const msg = isCurrent
            ? '現在のファイルをこの履歴の内容で上書きしますか？'
            : 'このファイルを復元して開きますか？\n(既にファイルが存在する場合は上書きされます。存在しない場合は再生成されます)';

        if (!window.confirm(msg)) return;

        const content = await window.electronAPI.getSnapshotContent(selectedSnapshot.hash);
        if (content === null) { window.alert('読み込み失敗'); return; }

        // ファイルを実際に保存（または作成）する
        await window.electronAPI.saveFile(content, selectedFile.path, false);

        if (isCurrent) {
            onRestore(content);
            window.alert('復元しました');
        } else {
            await window.electronAPI.openNewWindow(selectedFile.path);
            window.alert('新規ウィンドウで開きました');
        }
        loadFiles();
    };
    const handleRestoreAs = async () => {
        if (!selectedFile || !selectedSnapshot) return;
        const content = await window.electronAPI.getSnapshotContent(selectedSnapshot.hash);
        if (content === null) { window.alert('読み込み失敗'); return; }
        const savedPath = await window.electronAPI.saveFile(content, undefined, true);
        if (savedPath) window.alert('保存しました: ' + savedPath);
    };

    return (
        <div className="history-container">
            <div className="file-list-pane">
                <div style={{ padding: '16px 20px' }}>
                    <BackButton onClick={onBack} />
                </div>
                <div className="pane-header">履歴ファイル一覧</div>
                <div className="file-list">
                    {files.length === 0 && <div className="empty-state">履歴なし</div>}
                    {files.map(f => (
                        <div key={f.id} className={`file-item ${selectedFile?.id === f.id ? 'selected' : ''}`} onClick={() => handleSelectFile(f)}>
                            <div className="file-path">{f.path.split(/[\\/]/).pop()}</div>
                            <div className="file-status">{f.is_alive ? <span className="status-alive"> 存在</span> : <span className="status-lost"> 削除済み</span>}</div>
                            <button className="delete-btn" title="履歴を削除" onClick={(e) => handleDeleteFile(e, f)}>×</button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="main-pane">
                {selectedFile ? (
                    <div className="timeline-view">
                        <div className="timeline-list">
                            <div className="pane-header">タイムライン</div>
                            {snapshots.map(s => (
                                <div key={s.id} className={`timeline-item ${selectedSnapshot?.id === s.id ? 'selected' : ''}`} onClick={() => handleSelectSnapshot(s)}>
                                    <div className="timeline-date">{formatDate(s.created_at)}</div>
                                    <div className="timeline-stats"><span>{s.char_count}字</span>{s.change_delta !== 0 && <span style={{ color: s.change_delta > 0 ? '#4ec9b0' : '#f14c4c' }}>{s.change_delta > 0 ? '+' : ''}{s.change_delta}</span>}</div>
                                </div>
                            ))}
                        </div>
                        <div className="diff-preview-pane">
                            {selectedSnapshot ? (
                                <>
                                    <div className="diff-header">
                                        <div>履歴: {formatDate(selectedSnapshot.created_at)}</div>
                                        <div className="restore-actions">
                                            <button className="btn btn-primary" onClick={handleRestoreOverwrite}>復元</button>
                                            <button className="btn btn-secondary" onClick={handleRestoreAs}>別名保存</button>
                                        </div>
                                    </div>
                                    <div className="diff-content">
                                        {diff ? diff.changes.map((p, i) => <span key={i} className={`diff-line ${p.added ? 'added' : p.removed ? 'removed' : 'unchanged'}`}>{p.value}</span>) : <div className="empty-state">読込中</div>}
                                    </div>
                                </>
                            ) : <div className="empty-state">履歴を選択</div>}
                        </div>
                    </div>
                ) : <div className="empty-state">左のリストからファイルを選択してください</div>}
            </div>
        </div>
    );
};

function formatDate(s: string) {
    if (!s) return '';
    try { const d = new Date(s.replace(' ', 'T') + 'Z'); return format(d, 'yyyy/MM/dd HH:mm:ss'); }
    catch { return s; }
}

export default HistoryPage;
