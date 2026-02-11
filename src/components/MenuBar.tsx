import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Minus, Square, Copy, X } from 'lucide-react'
import appIcon from '../assets/icon/icon.png'
import '../styles/MenuBar.css'

interface MenuItemData {
  label?: string
  accelerator?: string
  submenu?: MenuItemData[]
  type?: 'separator' | 'checkbox' | 'radio'
  checked?: boolean
  id?: string
  action?: string
  disabled?: boolean
}

interface MenuBarProps {
  onMenuClick: (type: string, data?: any) => void
  checkedItems?: { [key: string]: boolean | string }
  title?: string
  theme?: string
}

const MenuBar: React.FC<MenuBarProps> = ({ onMenuClick, checkedItems = {}, title = 'Kotoori - 新しいテキスト', theme = 'vs-dark' }) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [recentFiles, setRecentFiles] = useState<Array<{ id: number; path: string; is_alive?: number }>>([])
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // タイトルが長い場合は短縮する
  const truncateTitle = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) {
      return text;
    }
    // "Kotoori - " の部分と、ファイル名を分割
    const prefix = 'Kotoori - ';
    const filename = text.replace(prefix, '');
    const available = maxLength - prefix.length - 1; // "…" の分

    if (available <= 0) {
      return text.substring(0, maxLength);
    }

    return prefix + filename.substring(0, available) + '…';
  };

  const displayTitle = truncateTitle(title);

  const itemLabelTitle = (actionStr: string) => {
    const idx = actionStr.indexOf(':')
    if (idx >= 0) return actionStr.substring(idx + 1)
    return actionStr
  }

  const menus: { [key: string]: MenuItemData[] } = {
    'ファイル': [
      { label: '新しいテキスト', accelerator: 'Ctrl+N', action: 'new' },
      { label: '開く', accelerator: 'Ctrl+O', action: 'open' },
      {
        label: '最近使用したファイルを開く',
        submenu: recentFiles.length > 0 ? recentFiles.slice(0, 10).map(f => ({ label: f.path.split(/[\\/]/).pop() || f.path, action: `open-candidate:${f.path}`, disabled: f.is_alive === 0 })) : [{ label: '履歴がありません', action: '' }]
      },
      {
        label: '形式を選択して開きなおす',
        submenu: [
          { label: 'UTF-8', action: 'open-as-encoding:UTF-8' },
          { label: 'Shift-JIS', action: 'open-as-encoding:SHIFT-JIS' }
        ]
      },
      { type: 'separator' },
      { label: '上書き保存', accelerator: 'Ctrl+S', action: 'save' },
      { label: '名前を付けて保存', accelerator: 'Ctrl+Shift+S', action: 'save-as' },
      {
        label: '形式を選択して保存',
        submenu: [
          { label: 'UTF-8', action: 'save-as-encoding:UTF-8' },
          { label: 'Shift-JIS', action: 'save-as-encoding:SHIFT-JIS' }
        ]
      },
      { type: 'separator' },
      { label: '履歴を表示', accelerator: 'Ctrl+Y', action: 'show-history' },
      { type: 'separator' },
      { label: '終了', accelerator: 'Ctrl+Q', action: 'quit' }
    ],
    '編集': [
      { label: '元に戻す', accelerator: 'Ctrl+Z', action: 'undo' },
      { label: 'やり直し', accelerator: 'Ctrl+Y', action: 'redo' },
      { type: 'separator' },
      { label: '切り取り', accelerator: 'Ctrl+X', action: 'cut' },
      { label: 'コピー', accelerator: 'Ctrl+C', action: 'copy' },
      { label: '貼り付け', accelerator: 'Ctrl+V', action: 'paste' },
      { label: '削除', accelerator: 'Del', action: 'delete' },
      { type: 'separator' },
      { label: 'すべて選択', accelerator: 'Ctrl+A', action: 'selectAll' },
      { type: 'separator' },
      { label: 'ルビの挿入', action: 'insert-ruby' },
      { label: '傍点の挿入', action: 'insert-emphasis-dots' }
    ],
    '検索': [
      { label: '検索', accelerator: 'Ctrl+F', action: 'find' },
      { label: '置換', accelerator: 'Ctrl+H', action: 'replace' }
    ],
    '表示': [
      { label: '行番号', type: 'checkbox', id: 'view:line-numbers', checked: checkedItems['view:line-numbers'] !== false, action: 'set-line-numbers' },
      { label: 'ミニマップを表示', type: 'checkbox', id: 'view:minimap', checked: checkedItems['view:minimap'] === true, action: 'set-minimap' },
      { label: 'アウトラインを表示', type: 'checkbox', id: 'view:outline', checked: checkedItems['view:outline'] !== false, action: 'set-show-outline' },
      { label: 'ルビ・傍点ツール', type: 'checkbox', id: 'view:ruby-toolbar', checked: checkedItems['view:ruby-toolbar'] !== false, action: 'set-show-ruby-toolbar' },
      { label: 'Markdownツール', type: 'checkbox', id: 'view:markdown-toolbar', checked: checkedItems['view:markdown-toolbar'] !== false, action: 'set-show-markdown-toolbar' },
      { label: '折り返し', type: 'checkbox', id: 'view:word-wrap', checked: checkedItems['view:word-wrap'] !== false, action: 'set-word-wrap' },
      { label: 'Markdownプレビュー', type: 'checkbox', id: 'view:preview', checked: checkedItems['view:preview'] === true, action: 'set-preview' },
    ],
    '設定': [
      { label: '詳細設定...', accelerator: 'Ctrl+,', action: 'show-settings' },
      { type: 'separator' },
      {
        label: 'テーマ',
        submenu: [
          { label: '宵闇', type: 'radio', id: 'theme:vs-dark', checked: checkedItems['theme:vs-dark'] === true, action: 'set-theme:vs-dark' },
          { label: '光明', type: 'radio', id: 'theme:light', checked: checkedItems['theme:light'] === true, action: 'set-theme:light' },
          { label: '生成り色', type: 'radio', id: 'theme:organic-note', checked: checkedItems['theme:organic-note'] === true, action: 'set-theme:organic-note' },
          { label: '月光', type: 'radio', id: 'theme:moonlight', checked: checkedItems['theme:moonlight'] === true, action: 'set-theme:moonlight' },
          { label: '長良川', type: 'radio', id: 'theme:nagaragawa', checked: checkedItems['theme:nagaragawa'] === true, action: 'set-theme:nagaragawa' },
          { label: '刀', type: 'radio', id: 'theme:katana', checked: checkedItems['theme:katana'] === true, action: 'set-theme:katana' }
        ]
      },
      {
        label: 'フォントサイズ',
        submenu: [10, 12, 14, 16, 18, 20, 24, 30].map(size => ({
          label: String(size),
          type: 'radio',
          id: `font-size:${size}`,
          checked: checkedItems[`font-size:${size}`] === true,
          action: `set-font-size:${size}`
        }))
      }
    ]
  }

  // クリック外閉じ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
        setOpenSubmenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ウィンドウの最大化状態を初期化
  useEffect(() => {
    if (window.electronAPI?.getWindowMaximized) {
      window.electronAPI.getWindowMaximized().then((maximized: boolean) => {
        setIsMaximized(maximized)
      }).catch(() => { })
    }
  }, [])

  // ファイルメニューを開いたときに最近使用したファイルを取得
  useEffect(() => {
    if (openMenu !== 'ファイル') return
    if (!window.electronAPI?.getHistoryFiles) return
    window.electronAPI.getHistoryFiles().then((files: any[]) => {
      // 直近利用順に並べ替え（id降順）して先頭10件
      const sorted = (files || []).slice().sort((a: any, b: any) => (b.id || 0) - (a.id || 0))
      setRecentFiles(sorted.slice(0, 10))
    }).catch(() => {
      setRecentFiles([])
    })
  }, [openMenu])

  // メインからの最大化/復元通知を受け取り UI を同期
  useEffect(() => {
    if (!window.electronAPI?.onWindowMaximize) return
    const remove = window.electronAPI.onWindowMaximize((_e: any, maximized: boolean) => {
      setIsMaximized(!!maximized)
    })
    return () => remove()
  }, [])

  const handleMenuItemClick = (item: MenuItemData) => {
    if (!item.action) return

    // Split only on the first ':' to allow Windows drive letters in params
    const idx = item.action.indexOf(':')
    let action = item.action
    let param: string | number | boolean | undefined = undefined
    if (idx >= 0) {
      action = item.action.substring(0, idx)
      const raw = item.action.substring(idx + 1)
      param = isNaN(Number(raw)) ? raw : Number(raw)
    }

    // チェックボックスの場合、チェック状態を反対にして渡す
    if (item.type === 'checkbox') {
      param = !item.checked
    }

    onMenuClick(action, param)

    setOpenMenu(null)
    setOpenSubmenu(null)
  }

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow?.().catch(() => { })
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow?.().then((maximized: boolean) => {
        setIsMaximized(maximized)
      }).catch(() => { })
    }
  }

  // ダブルクリック時は即時にアイコン/ツールチップを切り替えしてから実際の最大化処理を呼ぶ
  const handleDoubleClick = () => {
    // UI を素早く切り替える（ボタンの title とアイコンの条件分岐に効く）
    setIsMaximized(prev => !prev)
    // 実際のウィンドウ状態はメインに処理をゆだね、結果で再同期する
    handleMaximize()
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.confirmAction('close')
    }
  }

  return (
    <div
      ref={menuRef}
      className={`menubar theme-${theme}`}
      onDoubleClick={handleDoubleClick}
    >
      {/* アプリアイコン（左側） */}
      <div className="menubar-app-icon">
        <img src={appIcon} alt="Kotoori" title="Kotoori" />
      </div>

      {/* メニューバー */}
      <div className="menubar-menus">
        {Object.entries(menus).map(([menuName, items]) => (
          <div key={menuName} className="menubar-item">
            <button
              className={`menubar-button ${openMenu === menuName ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === menuName ? null : menuName)}
              onMouseEnter={() => openMenu && setOpenMenu(menuName)}
            >
              {menuName}
            </button>
            {openMenu === menuName && (
              <div className="menubar-dropdown">
                {items.map((item, index) => (
                  item.type === 'separator' ? (
                    <div key={`sep-${index}`} className="menubar-separator" />
                  ) : item.submenu ? (
                    <div
                      key={item.label || `submenu-${index}`}
                      className="menubar-submenu-container"
                      onMouseEnter={() => setOpenSubmenu(item.label || null)}
                      onMouseLeave={() => setOpenSubmenu(null)}
                    >
                      <div className="menubar-submenu-button">
                        {item.type === 'checkbox' && (
                          <input
                            type="checkbox"
                            checked={item.checked || false}
                            onChange={() => { }}
                            className="menubar-checkbox"
                          />
                        )}
                        {item.type === 'radio' && (
                          <input
                            type="radio"
                            checked={item.checked || false}
                            onChange={() => { }}
                            className="menubar-radio"
                          />
                        )}
                        {item.label && <span>{item.label}</span>}
                        <ChevronDown size={16} className="menubar-chevron" />
                      </div>
                      {openSubmenu === (item.label || null) && (
                        <div className="menubar-submenu">
                          {item.submenu.map((subitem, subindex) => (
                            subitem.type === 'separator' ? (
                              <div key={`subsep-${subindex}`} className="menubar-separator" />
                            ) : (
                              <button
                                key={subitem.label || `subitem-${subindex}`}
                                className={`menubar-submenu-item ${subitem.disabled ? 'disabled' : ''}`}
                                onClick={() => { if (!subitem.disabled) handleMenuItemClick(subitem) }}
                                disabled={!!subitem.disabled}
                                title={subitem.disabled && typeof subitem.action === 'string' ? itemLabelTitle(subitem.action) : undefined}
                              >
                                {subitem.type === 'checkbox' && (
                                  <input
                                    type="checkbox"
                                    checked={subitem.checked || false}
                                    onChange={() => handleMenuItemClick(subitem)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="menubar-checkbox"
                                  />
                                )}
                                {subitem.type === 'radio' && (
                                  <input
                                    type="radio"
                                    checked={subitem.checked || false}
                                    onChange={() => handleMenuItemClick(subitem)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="menubar-radio"
                                  />
                                )}
                                {subitem.label && <span className="menubar-submenu-label">{subitem.label}</span>}
                                {subitem.accelerator && <span className="menubar-shortcut">{subitem.accelerator}</span>}
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      key={item.label || `item-${Math.random()}`}
                      className="menubar-menu-item"
                      onClick={() => handleMenuItemClick(item)}
                    >
                      {item.type === 'checkbox' && (
                        <input
                          type="checkbox"
                          checked={item.checked || false}
                          onChange={() => handleMenuItemClick(item)}
                          onClick={(e) => e.stopPropagation()}
                          className="menubar-checkbox"
                        />
                      )}
                      {item.type === 'radio' && (
                        <input
                          type="radio"
                          checked={item.checked || false}
                          onChange={() => handleMenuItemClick(item)}
                          onClick={(e) => e.stopPropagation()}
                          className="menubar-radio"
                        />
                      )}
                      {item.label && <span className="menubar-label">{item.label}</span>}
                      {item.accelerator && <span className="menubar-shortcut">{item.accelerator}</span>}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ウィンドウタイトル（中央） */}
      <div className="menubar-title" title={title}>
        <span>{displayTitle}</span>
      </div>

      {/* ウィンドウコントロールボタン（右側） */}
      <div className="menubar-window-controls">
        <button className="menubar-control-btn minimize-btn" onClick={handleMinimize} title="最小化">
          <Minus size={16} />
        </button>
        <button className="menubar-control-btn maximize-btn" onClick={handleMaximize} title={isMaximized ? "復元" : "最大化"}>
          {isMaximized ? <Copy size={16} /> : <Square size={16} />}
        </button>
        <button className="menubar-control-btn close-btn" onClick={handleClose} title="閉じる">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default MenuBar
