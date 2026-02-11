import React from 'react';

interface StatusBarProps {
    line: number;
    column: number;
    selectedChars: number;
    totalLines: number;
    totalChars: number;
    currentLineChars: number;
    autoIndent: boolean;
    showGenkoyoushiMode?: boolean;
    code?: string;
    encoding?: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS';
    lastSaveTime?: string | null;
}

const StatusBar: React.FC<StatusBarProps> = ({
    line,
    column,
    selectedChars,
    totalLines,
    totalChars,
    currentLineChars,
    autoIndent,
    showGenkoyoushiMode = false,
    code = '',
    encoding = 'UTF-8',
    lastSaveTime = null
}) => {
    // 原稿用紙換算を計算
    const calculateGenkoyoushi = () => {
        if (!code) return 0;
        
        // 改行コード（\r\n または \n）で分割
        const lines = code.split(/\r?\n/);
        
        // 各行ごとに ceil(文字数/20) を計算し、合計を出す
        let totalLineCount = 0;
        lines.forEach(lineText => {
            // 各行の文字数を取得
            const lineLength = lineText.length;
            // ceil(lineLength / 20) を計算
            const lineCount = Math.ceil(lineLength / 20);
            totalLineCount += lineCount;
        });
        
        // 20で割って原稿用紙枚数を計算
        const sheets = totalLineCount / 20;
        return sheets;
    };

    const genkoyoushiSheets = calculateGenkoyoushi();
    // 「#,###.#枚」の形式にフォーマット
    const formattedSheets = genkoyoushiSheets.toLocaleString('ja-JP', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    return (
        <footer style={{
            height: '24px',
            backgroundColor: 'var(--status-bg, #007acc)',
            color: 'var(--status-text, white)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '12px',
            fontFamily: 'Segoe UI, sans-serif',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            gap: '15px',
            overflow: 'auto'
        }}>
            <span>位置({line}, {column})</span>
            <span>選択文字数: {selectedChars}</span>
            <span>総行数: {totalLines}</span>
            <span>総文字数: {totalChars}</span>
            <span>選択行文字数: {currentLineChars}</span>
            {showGenkoyoushiMode && (
                <span>原稿用紙: {formattedSheets}枚</span>
            )}
            <span style={{ marginLeft: 'auto' }}>
                保存: {lastSaveTime || '-'}
                {' | '}
                AutoIndent: {autoIndent ? 'ON' : 'OFF'}
                {' | '}
                {encoding === 'SHIFT-JIS' ? 'S-JIS' : encoding}
            </span>
        </footer>
    );
};

export default StatusBar;
