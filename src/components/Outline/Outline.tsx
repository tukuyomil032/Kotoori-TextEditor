import React, { useState, useRef, useEffect } from 'react';
import './Outline.css';
import { useEditorSettings, EditorSettings } from '../../hooks/useEditorSettings';

export interface OutlineItem {
    label: string;
    level: number;
    line: number;
}

interface OutlineProps {
    items: OutlineItem[];
    onItemClick: (line: number) => void;
    activeLine: number;
    width: number;
    onWidthChange: (width: number) => void;
    settings?: EditorSettings;
}

const Outline: React.FC<OutlineProps> = (props) => {
    const { items, onItemClick, activeLine, width, onWidthChange, settings } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const hook = useEditorSettings();
    const settingsToUse: EditorSettings = settings ?? hook.settings;

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = e.clientX - rect.left;
            
            // 最小幅150px、最大幅600pxの制限
            if (newWidth >= 150 && newWidth <= 600) {
                onWidthChange(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onWidthChange]);

    // 現在の行に最も近い見出しを特定する
    const activeIndex = items.reduce((prev, curr, idx) => {
        if (curr.line <= activeLine) {
            return idx;
        }
        return prev;
    }, -1);

    // アクティブアイテムが変わったらアウトライン側をスクロールして表示させる
    useEffect(() => {
        if (isDragging) return; // リサイズ中はスクロールしない
        const listEl = listRef.current;
        if (!listEl) return;
        const activeEl = listEl.querySelector('.outline-item.active') as HTMLElement | null;
        if (!activeEl) return;
        const listRect = listEl.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        if (elRect.top < listRect.top || elRect.bottom > listRect.bottom) {
            try { activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { activeEl.scrollIntoView(false); }
        }
    }, [activeIndex, items, isDragging]);

    return (
        <div className="outline-container" ref={containerRef} style={{ width: `${width}px` }}>
            {items.length === 0 ? (
                <div className="outline-empty-msg">見出しがありません</div>
            ) : (
                <>
                    <div className="outline-header">アウトライン ({items.length})</div>
                    <div
                        className="outline-list"
                        ref={listRef}
                        style={{
                            fontFamily: settingsToUse.fontFamily,
                            fontSize: `${settingsToUse.fontSize}px`,
                            lineHeight: settingsToUse.lineHeight,
                        }}
                    >
                        {items.map((item, index) => (
                            <div
                                key={`${item.line}-${index}`}
                                className={`outline-item level-${item.level} ${index === activeIndex ? 'active' : ''}`}
                                onClick={() => onItemClick(item.line)}
                                title={item.label}
                            >
                                <span className="outline-label">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <div 
                className="outline-resize-handle"
                onMouseDown={() => setIsDragging(true)}
                title="ドラッグでウィンドウ幅を変更"
            />
        </div>
    );
};

export default Outline;
