import React from 'react'
import {
  FilePlus, FolderOpen, Save, Clock, ChartNoAxesGantt, Eye, EyeOff,
  Bold, Italic, Heading, Link, List, ListOrdered, Quote, Code
} from 'lucide-react'
import rubyIcon from '../assets/icon/ruby.svg'
import pointIcon from '../assets/icon/point.svg'
import '../styles/ToolBar.css'

interface ToolBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onShowHistory: () => void
  showOutline: boolean
  onToggleOutline: () => void
  isPreviewVisible: boolean
  onTogglePreview: () => void
  previewMode: 'markdown' | 'vertical'
  onTogglePreviewMode: (mode: 'markdown' | 'vertical') => void
  onInsertRuby: () => void
  onInsertEmphasisDots: () => void
  onBold: () => void
  onItalic: () => void
  onHeading: () => void
  onLink: () => void
  onList: () => void
  onListOrdered: () => void
  onQuote: () => void
  onCode: () => void
  showRuby?: boolean
  showMarkdown?: boolean
}

const ToolBar: React.FC<ToolBarProps> = ({
  onNew,
  onOpen,
  onSave,
  onShowHistory,
  showOutline,
  onToggleOutline,
  isPreviewVisible,
  onTogglePreview,
  previewMode,
  onTogglePreviewMode,
  onInsertRuby,
  onInsertEmphasisDots,
  onBold,
  onItalic,
  onHeading,
  onLink,
  onList,
  onListOrdered,
  onQuote,
  onCode,
  showRuby = true,
  showMarkdown = true,
}) => {
  return (
    <div className="toolbar">
      <button
        className="toolbar-btn"
        onClick={onNew}
        title="新しいテキスト (Ctrl+N)"
        aria-label="新規作成"
      >
        <FilePlus size={20} />
      </button>
      <button
        className="toolbar-btn"
        onClick={onOpen}
        title="ファイルを開く (Ctrl+O)"
        aria-label="ファイルを開く"
      >
        <FolderOpen size={20} />
      </button>
      <button
        className="toolbar-btn"
        onClick={onSave}
        title="ファイルを保存 (Ctrl+S)"
        aria-label="ファイルを保存"
      >
        <Save size={20} />
      </button>
      <button
        className="toolbar-btn"
        onClick={onShowHistory}
        title="履歴を表示 (Ctrl+Y)"
        aria-label="履歴表示"
      >
        <Clock size={20} />
      </button>

      <div className="toolbar-separator" />

      <button
        className={`toolbar-btn ${showOutline ? 'active' : ''}`}
        onClick={onToggleOutline}
        title="アウトラインを表示/非表示"
        aria-label="アウトラインの表示切り替え"
      >
        <ChartNoAxesGantt size={20} />
      </button>
      <button
        className={`toolbar-btn ${isPreviewVisible ? 'active' : ''}`}
        onClick={onTogglePreview}
        title="Markdownプレビューを表示/非表示"
        aria-label="Markdownプレビューの表示切り替え"
      >
        {isPreviewVisible ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>

      {isPreviewVisible && (
        <button
          className="toolbar-btn"
          style={{ fontSize: '12px', fontWeight: 'bold' }}
          onClick={() => onTogglePreviewMode(previewMode === 'markdown' ? 'vertical' : 'markdown')}
          title={previewMode === 'markdown' ? '縦書きプレビューに切り替え' : 'Markdownプレビューに切り替え'}
        >
          {previewMode === 'markdown' ? '縦' : '横'}
        </button>
      )}

      {showRuby && (
        <>
          <div className="toolbar-separator" />
          <button
            className="toolbar-btn"
            onClick={onInsertRuby}
            title="ルビの挿入"
            aria-label="ルビの挿入"
          >
            <img src={rubyIcon} alt="ルビ" style={{ width: '20px', height: '20px' }} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onInsertEmphasisDots}
            title="傍点の挿入"
            aria-label="傍点の挿入"
          >
            <img src={pointIcon} alt="傍点" style={{ width: '20px', height: '20px' }} />
          </button>
        </>
      )}

      {showMarkdown && (
        <>
          <div className="toolbar-separator" />
          <button
            className="toolbar-btn"
            onClick={onBold}
            title="太字"
            aria-label="太字"
          >
            <Bold size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onItalic}
            title="斜体"
            aria-label="斜体"
          >
            <Italic size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onHeading}
            title="見出し"
            aria-label="見出し"
          >
            <Heading size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onLink}
            title="リンク"
            aria-label="リンク"
          >
            <Link size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onList}
            title="箇条書きリスト"
            aria-label="箇条書きリスト"
          >
            <List size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onListOrdered}
            title="番号付きリスト"
            aria-label="番号付きリスト"
          >
            <ListOrdered size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onQuote}
            title="引用"
            aria-label="引用"
          >
            <Quote size={20} />
          </button>
          <button
            className="toolbar-btn"
            onClick={onCode}
            title="コード"
            aria-label="コード"
          >
            <Code size={20} />
          </button>
        </>
      )}
    </div>
  );
}

export default ToolBar
