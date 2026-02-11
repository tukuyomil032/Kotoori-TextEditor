import { BrowserWindow } from 'electron'
import { MenuItemConfig } from './MenuBar'

export class MenuTemplate {
  static createTemplate(systemFonts: string[]): MenuItemConfig[] {
    const sendMenuClick = (win: BrowserWindow | null, action: string, data?: any) => {
      if (win) win.webContents.send('menu-click', action, data)
    }

    return [
      {
        label: 'ファイル',
        submenu: [
          {
            label: '新しいテキスト',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'new')
            }
          },
          {
            label: '開く',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'open')
            }
          },
          {
            label: '形式を選択して開きなおす',
            submenu: [
              {
                label: 'UTF-8',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'open-as-encoding', 'UTF-8')
                }
              },
              {
                label: 'Shift-JIS',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'open-as-encoding', 'SHIFT-JIS')
                }
              }
            ]
          },
          {
            label: '上書き保存',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'save')
            }
          },
          {
            label: '名前を付けて保存',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'save-as')
            }
          },
          {
            label: '形式を選択して保存',
            submenu: [
              {
                label: 'UTF-8',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'save-as-encoding', 'UTF-8')
                }
              },
              {
                label: 'Shift-JIS',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'save-as-encoding', 'SHIFT-JIS')
                }
              }
            ]
          },
          { type: 'separator' },
          {
            label: '履歴を表示',
            accelerator: 'CmdOrCtrl+Y',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'show-history')
            }
          },
          { type: 'separator' },
          {
            label: '終了',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'quit')
            }
          }
        ]
      },
      {
        label: '編集',
        submenu: [
          {
            label: '元に戻す',
            accelerator: 'CmdOrCtrl+Z',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'undo')
            }
          },
          {
            label: 'やり直し',
            accelerator: 'CmdOrCtrl+Shift+Z',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'redo')
            }
          },
          { type: 'separator' },
          {
            label: '切り取り',
            accelerator: 'CmdOrCtrl+X',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'cut')
            }
          },
          {
            label: 'コピー',
            accelerator: 'CmdOrCtrl+C',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'copy')
            }
          },
          {
            label: '貼り付け',
            accelerator: 'CmdOrCtrl+V',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'paste')
            }
          },
          {
            label: '削除',
            accelerator: 'Delete',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'delete')
            }
          },
          { type: 'separator' },
          {
            label: 'すべて選択',
            accelerator: 'CmdOrCtrl+A',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'selectAll')
            }
          }
        ]
      },
      {
        label: '検索',
        submenu: [
          {
            label: '検索',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'find')
            }
          },
          {
            label: '置換',
            accelerator: 'CmdOrCtrl+H',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'replace')
            }
          }
        ]
      },
      {
        label: '表示',
        submenu: [
          {
            label: '行番号',
            type: 'checkbox',
            id: 'view:line-numbers',
            checked: true,
            click: (menuItem) => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'set-line-numbers', menuItem.checked)
            }
          },
          {
            label: 'ミニマップを表示',
            type: 'checkbox',
            id: 'view:minimap',
            checked: false,
            click: (menuItem) => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'set-minimap', menuItem.checked)
            }
          },
          {
            label: 'アウトラインを表示',
            type: 'checkbox',
            id: 'view:outline',
            checked: true,
            click: (menuItem) => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'set-show-outline', menuItem.checked)
            }
          },
          {
            label: '折り返し',
            type: 'checkbox',
            id: 'view:word-wrap',
            checked: true,
            click: (menuItem) => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'set-word-wrap', menuItem.checked ? 'on' : 'off')
            }
          }
        ]
      },
      {
        label: '設定',
        submenu: [
          {
            label: '詳細設定...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              sendMenuClick(win, 'show-settings')
            }
          },
          { type: 'separator' },
          {
            label: 'テーマ',
            submenu: [
              {
                label: 'ダーク',
                type: 'radio',
                id: 'theme:vs-dark',
                checked: true,
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'vs-dark')
                }
              },
              {
                label: 'ライト',
                type: 'radio',
                id: 'theme:light',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'light')
                }
              },
              {
                label: 'Organic Note',
                type: 'radio',
                id: 'theme:organic-note',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'organic-note')
                }
              },
              {
                label: 'Moonlight',
                type: 'radio',
                id: 'theme:moonlight',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'moonlight')
                }
              },
              {
                label: 'Nagaragawa',
                type: 'radio',
                id: 'theme:nagaragawa',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'nagaragawa')
                }
              },
              {
                label: 'Katana',
                type: 'radio',
                id: 'theme:katana',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow()
                  sendMenuClick(win, 'set-theme', 'katana')
                }
              }
            ]
          },
          {
            label: 'フォントサイズ',
            submenu: [10, 12, 14, 16, 18, 20, 24, 30].map(size => ({
              label: String(size),
              click: () => {
                const win = BrowserWindow.getFocusedWindow()
                sendMenuClick(win, 'set-font-size', size)
              }
            }))
          },
          {
            label: 'フォント',
            submenu: systemFonts.map(font => ({
              label: font,
              type: 'radio',
              id: `font:${font}`,
              click: () => {
                const win = BrowserWindow.getFocusedWindow()
                sendMenuClick(win, 'set-font-family', font)
              }
            }))
          }
        ]
      }
    ]
  }
}
