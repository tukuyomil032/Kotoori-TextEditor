import { app, BrowserWindow, Menu, dialog, ipcMain, clipboard } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { HistoryManager } from './history/HistoryManager'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import iconv from 'iconv-lite'

const execAsync = promisify(exec)

// GPU関連のエラー（SharedImageManager）を抑制するためのフラグ
if (process.platform === 'win32') {
  // ハードウェアアクセラレーションを無効化して GPU キャッシュ作成を防ぐ
  try {
    app.disableHardwareAcceleration()
  } catch (e) {
    // 無視: テスト環境や古い Electron では未サポートの可能性
    console.warn('disableHardwareAcceleration not available:', e)
  }
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  // キャッシュ作成先を明示してアクセス権限エラーを回避
  try {
    const tmpCache = path.join(os.tmpdir(), 'kotoori-electron-cache')
    app.commandLine.appendSwitch('disk-cache-dir', tmpCache)
    app.commandLine.appendSwitch('disable-application-cache')
  } catch (e) {
    console.warn('Failed to set disk-cache-dir switch:', e)
  }
}

let systemFonts: string[] = ['Meiryo', 'MS Gothic', 'Yu Gothic', 'Arial', 'Courier New']

async function loadSystemFonts() {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families.Name"')
      const fonts = stdout.split('\r\n').map(f => f.trim()).filter(f => f !== '')
      if (fonts.length > 0) systemFonts = Array.from(new Set(fonts)).sort()
      updateMenu()
    } catch (e) {
      console.error('Failed to load fonts:', e)
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const windows = new Set<BrowserWindow>()
let isQuitting = false

async function handleOpenFile(targetWin: BrowserWindow | null = null) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'json', 'html', 'htm'] }]
  })
  if (!canceled && filePaths.length > 0) {
    if (targetWin) {
      targetWin.webContents.send('menu-click', 'open-candidate', filePaths[0])
    } else {
      createWindow(false, filePaths[0])
    }
  }
}

async function getUniqueFilePath(filePath: string): Promise<string> {
  try {
    // ファイルが既に存在するかチェック
    const exists = existsSync(filePath)
    if (!exists) {
      return filePath
    }

    // ファイルが存在する場合、タイムスタンプを付加
    const dir = path.dirname(filePath)
    const ext = path.extname(filePath)
    const baseName = path.basename(filePath, ext)

    // 現在の日時を yyyymmddHHMM 形式で取得
    const now = new Date()
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0')

    const newFilePath = path.join(dir, `${baseName}_${timestamp}${ext}`)
    return newFilePath
  } catch (e) {
    console.error('Error getting unique file path:', e)
    return filePath
  }
}

// エンコード自動認識関数
function detectFileEncoding(filePath: string): 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS' {
  try {
    const buffer = readFileSync(filePath)

    // BOM チェック (UTF-8 BOM: EF BB BF)
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8-BOM'
    }

    // UTF-8 の有効性をチェック
    let isValidUTF8 = true
    let utf8Score = 0

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i]

      if ((byte & 0x80) === 0) {
        // ASCII (0xxxxxxx)
        utf8Score++
      } else if ((byte & 0xE0) === 0xC0) {
        // 2バイト文字の開始 (110xxxxx 10xxxxxx)
        if (i + 1 < buffer.length && (buffer[i + 1] & 0xC0) === 0x80) {
          utf8Score += 2
          i++
        } else {
          isValidUTF8 = false
          break
        }
      } else if ((byte & 0xF0) === 0xE0) {
        // 3バイト文字の開始 (1110xxxx 10xxxxxx 10xxxxxx)
        if (i + 2 < buffer.length &&
          (buffer[i + 1] & 0xC0) === 0x80 &&
          (buffer[i + 2] & 0xC0) === 0x80) {
          utf8Score += 3
          i += 2
        } else {
          isValidUTF8 = false
          break
        }
      } else if ((byte & 0xF8) === 0xF0) {
        // 4バイト文字の開始 (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
        if (i + 3 < buffer.length &&
          (buffer[i + 1] & 0xC0) === 0x80 &&
          (buffer[i + 2] & 0xC0) === 0x80 &&
          (buffer[i + 3] & 0xC0) === 0x80) {
          utf8Score += 4
          i += 3
        } else {
          isValidUTF8 = false
          break
        }
      } else {
        // 不正なバイト列
        isValidUTF8 = false
        break
      }
    }

    // UTF-8 が有効な場合、UTF-8 として扱う
    if (isValidUTF8 && utf8Score > 0) {
      return 'UTF-8'
    }

    // Shift-JIS の検出
    let sjisScore = 0

    for (let i = 0; i < buffer.length - 1; i++) {
      const byte1 = buffer[i]
      const byte2 = buffer[i + 1]

      // Shift-JIS の多バイト文字パターン
      // 第1バイト: 0x81-0x9F, 0xE0-0xEF
      // 第2バイト: 0x40-0x7E, 0x80-0xFC
      if ((byte1 >= 0x81 && byte1 <= 0x9F) || (byte1 >= 0xE0 && byte1 <= 0xEF)) {
        if ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFC)) {
          sjisScore += 2
          i++
        }
      } else if ((byte1 >= 0x00 && byte1 <= 0x7F) || (byte1 >= 0xA0 && byte1 <= 0xDF)) {
        // 半角カナまたは ASCII
        sjisScore++
      } else if (byte1 >= 0xFD && byte1 <= 0xFF) {
        // Shift-JIS では無効な範囲
        sjisScore = 0
        break
      }
    }

    // スコアベースの判定
    // Shift-JIS スコアが高い場合は Shift-JIS
    if (sjisScore > buffer.length * 0.8) {
      return 'SHIFT-JIS'
    }

    // デフォルトは UTF-8
    return 'UTF-8'
  } catch (e) {
    console.error('Error detecting encoding:', e)
    return 'UTF-8'
  }
}

// 簡易ながら改善したバイナリ判定（先頭サンプルのみを使用）
async function isBinaryFile(filePath: string, sampleSize: number = 4096): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r')
    try {
      const { buffer, bytesRead } = await fd.read(Buffer.alloc(sampleSize), 0, sampleSize, 0)
      const sample = buffer.slice(0, bytesRead)

      if (sample.length === 0) return false

      // 明確にバイナリと判定できるマジックバイトはそのまま
      if (sample.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47])) /* PNG */) return true
      if (sample.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF])) /* JPEG */) return true
      if (sample.slice(0, 4).toString('ascii', 0, 4) === 'GIF8') return true
      if (sample.slice(0, 4).toString('ascii', 0, 4) === '%PDF') return true
      if (sample.slice(0, 2).toString('ascii', 0, 2) === 'PK') return true // zip / OOXML
      if (sample.slice(0, 2).toString('ascii', 0, 2) === 'MZ') return true // PE executable

      // NUL バイトが多数含まれる場合はバイナリとするが、まれな1つだけの出現に過敏に反応しない
      const nulCount = sample.reduce((acc, b) => acc + (b === 0 ? 1 : 0), 0)
      if (nulCount > Math.max(1, sample.length * 0.001)) return true

      // UTF-8 の簡易検証を先に行う（日本語等のマルチバイトで誤検出しないように）
      const isValidUtf8 = (buf: Buffer) => {
        let i = 0
        while (i < buf.length) {
          const byte = buf[i]
          if ((byte & 0x80) === 0) { i++; continue }
          if ((byte & 0xE0) === 0xC0) {
            if (i + 1 < buf.length && (buf[i + 1] & 0xC0) === 0x80) { i += 2; continue }
            return false
          }
          if ((byte & 0xF0) === 0xE0) {
            if (i + 2 < buf.length && (buf[i + 1] & 0xC0) === 0x80 && (buf[i + 2] & 0xC0) === 0x80) { i += 3; continue }
            return false
          }
          if ((byte & 0xF8) === 0xF0) {
            if (i + 3 < buf.length && (buf[i + 1] & 0xC0) === 0x80 && (buf[i + 2] & 0xC0) === 0x80 && (buf[i + 3] & 0xC0) === 0x80) { i += 4; continue }
            return false
          }
          return false
        }
        return true
      }

      if (isValidUtf8(sample)) return false

      // 制御文字比率を計算（\t,\n,\r は許容） — 閾値を緩める
      let control = 0
      let printable = 0
      for (let i = 0; i < sample.length; i++) {
        const b = sample[i]
        if (b === 0x09 || b === 0x0A || b === 0x0D) { printable++; continue }
        if (b >= 0x20 && b <= 0x7E) { printable++; continue }
        control++
      }
      const denom = control + printable || 1
      const controlRatio = control / denom
      // 以前は 0.30。誤検出を避けるため 0.45 に緩和
      if (controlRatio > 0.45) return true

      // Shift-JIS 等の可能性が高ければテキスト扱いにする（簡易スコア）
      let sjisScore = 0
      for (let i = 0; i < sample.length - 1; i++) {
        const b1 = sample[i]
        const b2 = sample[i + 1]
        if ((b1 >= 0x81 && b1 <= 0x9F) || (b1 >= 0xE0 && b1 <= 0xEF)) {
          if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFC)) { sjisScore += 2; i++ }
        } else if ((b1 >= 0x00 && b1 <= 0x7F) || (b1 >= 0xA0 && b1 <= 0xDF)) {
          sjisScore++
        }
      }
      if (sjisScore > sample.length * 0.5) return false

      // 判定できなければ安全側でテキスト扱いにする（誤検出を減らすため）
      return false
    } finally {
      await fd.close()
    }
  } catch (e) {
    console.error('Failed to check if file is binary (improved):', e)
    return false
  }
}

async function handleSaveFile(targetWin: BrowserWindow | null, content: string, filePath?: string, forceDialog: boolean = false, encoding: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS' = 'UTF-8', isNewFile: boolean = false) {
  if (!targetWin) return null

  // エンコードに応じたバッファ作成
  const encodeContent = (text: string, enc: string): Buffer => {
    if (enc === 'UTF-8') {
      return Buffer.from(text, 'utf8')
    } else if (enc === 'UTF-8-BOM') {
      const utf8Buffer = Buffer.from(text, 'utf8')
      const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF])
      return Buffer.concat([bomBuffer, utf8Buffer])
    } else if (enc === 'SHIFT-JIS') {
      return iconv.encode(text, 'shift_jis')
    }
    return Buffer.from(text, 'utf8')
  }

  if (filePath && !forceDialog) {
    try {
      // 新規ファイルの場合のみ、ファイルが存在したらタイムスタンプを付加
      let savePath = filePath
      if (isNewFile) {
        savePath = await getUniqueFilePath(filePath)
      }
      const buffer = encodeContent(content, encoding)
      await fs.writeFile(savePath, buffer)
      return savePath
    } catch (e) {
      console.error('Failed to save file:', e)
      return null
    }
  }
  const options: Electron.SaveDialogOptions = {
    filters: [{ name: 'Text Files', extensions: ['txt', 'html', 'htm'] }]
  }
  if (filePath) options.defaultPath = filePath
  const { canceled, filePath: savePath } = await dialog.showSaveDialog(targetWin, options)
  if (!canceled && savePath) {
    // ダイアログからの保存は常に新規扱いとしてタイムスタンプ付与
    const uniquePath = await getUniqueFilePath(savePath)
    const buffer = encodeContent(content, encoding)
    await fs.writeFile(uniquePath, buffer)
    return uniquePath
  }
  return null
}

async function performAction(event: Electron.IpcMainInvokeEvent | null, action: 'open' | 'quit' | 'close') {
  if (action === 'open') {
    const win = event ? BrowserWindow.fromWebContents(event.sender) : null
    await handleOpenFile(win)
  }
  else if (action === 'quit') { isQuitting = true; app.quit(); }
  else if (action === 'close' && event) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      windows.delete(win)
      win.destroy()
    }
  }
}

function updateMenu() {
  // カスタムメニューバーを使用しているため、Electron標準メニューは非表示
  Menu.setApplicationMenu(null)
}

function createWindow(isEmpty: boolean = false, filePath?: string) {
  let win = new BrowserWindow({
    width: 1200, height: 800,
    icon: path.join(__dirname, '../assets/icons/icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: { preload: path.join(__dirname, 'preload.mjs') },
  })
  windows.add(win)
  // ウィンドウ最大化/復元のイベントをレンダラーに通知
  win.on('maximize', () => {
    try { if (!win.isDestroyed()) win.webContents.send('window-maximized', true) } catch (e) { }
  })
  win.on('unmaximize', () => {
    try { if (!win.isDestroyed()) win.webContents.send('window-maximized', false) } catch (e) { }
  })
  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
    win.webContents.send('check-autosave', 'close')
  })

  // 開発者ツールを開くショートカットキーを有効化 (Menu.setApplicationMenu(null) の影響で無効になっているため)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isMac = process.platform === 'darwin'
      const controlOrCommand = isMac ? input.meta : input.control

      // F12 または Ctrl+Shift+I (Macの場合は Cmd+Option+I)
      const isF12 = input.key === 'F12'
      const isDevToolsShortcut = (controlOrCommand && input.shift && input.key.toLowerCase() === 'i') ||
        (isMac && input.alt && input.meta && input.key.toLowerCase() === 'i')

      if (isF12 || isDevToolsShortcut) {
        win.webContents.toggleDevTools()
        event.preventDefault()
      }
    }
  })

  updateMenu()

  const query: Record<string, string> = {}
  if (isEmpty) query.empty = 'true'
  if (filePath) query.path = filePath

  if (VITE_DEV_SERVER_URL) {
    const url = new URL(VITE_DEV_SERVER_URL)
    if (isEmpty) url.searchParams.set('empty', 'true')
    if (filePath) url.searchParams.set('path', filePath)
    win.loadURL(url.toString())
  }
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'), { query })
}

function getFilePathFromArgs() {
  let args = process.argv

  // Vite 経由の場合、環境変数から引数を取得
  if (process.env.VITE_DEV_ELECTRON_ARGS) {
    try {
      const extraArgs = JSON.parse(process.env.VITE_DEV_ELECTRON_ARGS)
      if (Array.isArray(extraArgs)) {
        args = [...args, ...extraArgs]
      }
    } catch (e) {
      console.error('Failed to parse VITE_DEV_ELECTRON_ARGS:', e)
    }
  }

  // 後の引数ほど優先される（npm run dev -- [path] の [path] は最後の方に来る）
  for (let i = args.length - 1; i >= 0; i--) {
    let arg = args[i]
    if (!arg || arg.startsWith('-')) continue

    // 引用符で囲まれている場合を考慮
    arg = arg.replace(/^["']|["']$/g, '')

    // プログラム自身の exe 名を取得（例: kotoori.exe） 
    const exeName = path.basename(process.execPath).toLowerCase()
    // プログラム自身や electron、main.js、カレントディレクトリを除外
    const lowerArg = arg.toLowerCase()
    if (
      lowerArg.endsWith('electron.exe') ||
      lowerArg.endsWith('main.js') ||
      lowerArg.endsWith(exeName) || // ← これが追加された安全策
      arg === '.'
    ) continue
    try {
      const fullPath = path.isAbsolute(arg) ? arg : path.resolve(arg)
      if (existsSync(fullPath) && lstatSync(fullPath).isFile()) {
        return fullPath
      }
    } catch (e) {
      // 無視
    }
  }
  return null
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); })

const historyDBPath = path.join(app.getPath('userData'), 'history.db')
const blobPath = path.join(app.getPath('userData'), '.history_blobs')
const historyManager = new HistoryManager(historyDBPath, blobPath)

app.whenReady().then(async () => {
  ipcMain.handle('save-file', async (event, content, filePath, forceDialog, encoding = 'UTF-8', isNewFile = false) => {
    const res = await handleSaveFile(BrowserWindow.fromWebContents(event.sender), content, filePath, forceDialog, encoding, isNewFile)
    if (res) try { historyManager.saveSnapshot(res, content); } catch (e) { console.error('Failed to save snapshot:', e); }
    return res
  })
  ipcMain.handle('read-file', async (event, p, forcedEncoding) => {
    try {
      // 先頭サンプルでバイナリ判定（誤検出対策としてフォールバックでエンコーディング検査）
      const binary = await isBinaryFile(p)
      if (binary) {
        try {
          // フォールバック: エンコーディング検査で UTF-8/UTF-8-BOM/SHIFT-JIS が返ればテキストとみなす
          try {
            const fallbackEnc = detectFileEncoding(p)
            if (fallbackEnc === 'UTF-8' || fallbackEnc === 'UTF-8-BOM' || fallbackEnc === 'SHIFT-JIS') {
              // 誤検出の可能性があるため、このまま読み込みを続行する
              console.warn('isBinaryFile returned true but detectFileEncoding suggests text, proceeding to read as text:', fallbackEnc)
            } else {
              const win = BrowserWindow.fromWebContents(event.sender)
              if (win && !win.isDestroyed()) {
                await dialog.showMessageBox(win, {
                  type: 'warning',
                  title: '警告',
                  message: 'バイナリファイルは読み込みできません。',
                  buttons: ['OK']
                })
              }
              return null
            }
          } catch (e) {
            // エンコーディング検査に失敗したら安全側でダイアログ表示
            const win = BrowserWindow.fromWebContents(event.sender)
            if (win && !win.isDestroyed()) {
              await dialog.showMessageBox(win, {
                type: 'warning',
                title: '警告',
                message: 'バイナリファイルは読み込みできません。',
                buttons: ['OK']
              })
            }
            return null
          }
        } catch (e) {
          console.error('Failed to handle binary fallback:', e)
          return null
        }
      }

      // 強制エンコーディングが指定されている場合はそれを優先して読み込む
      const buffer = readFileSync(p)
      let encoding: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS'
      if (forcedEncoding && (forcedEncoding === 'UTF-8' || forcedEncoding === 'UTF-8-BOM' || forcedEncoding === 'SHIFT-JIS')) {
        encoding = forcedEncoding
      } else {
        encoding = detectFileEncoding(p)
      }

      let text: string
      if (encoding === 'UTF-8-BOM') {
        // BOMを削除
        text = iconv.decode(buffer.slice(3), 'utf8')
      } else if (encoding === 'SHIFT-JIS') {
        text = iconv.decode(buffer, 'shift_jis')
      } else {
        text = buffer.toString('utf8')
      }

      return { content: text, encoding }
    } catch (e) {
      return null
    }
  })
  ipcMain.handle('history:get-files', () => { historyManager.checkLiveness(); return historyManager.getAllFiles(); })
  ipcMain.handle('history:get-snapshots', (_, p) => historyManager.getHistory(p))
  ipcMain.handle('history:get-content', (_, h) => historyManager.getSnapshotContent(h))
  ipcMain.handle('history:get-diff', (_, o, n) => historyManager.getDiff(o, n))
  ipcMain.handle('history:delete-file', (_, id) => historyManager.deleteFileHistory(id))
  ipcMain.handle('confirm-action', async (event, a) => await performAction(event, a))
  ipcMain.handle('open-file-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await handleOpenFile(win)
  })
  ipcMain.handle('create-new-window', async () => {
    createWindow(true)
  })
  ipcMain.handle('get-documents-path', () => app.getPath('documents'))
  ipcMain.handle('join-path', (_, ...ps) => path.join(...ps))
  ipcMain.handle('get-default-path', async () => { const p = path.join(app.getPath('documents'), 'Kotoori'); await fs.mkdir(p, { recursive: true }); return p; })
  const oldCachePath = path.join(app.getPath('userData'), 'manicashe.json')
  const cachePath = path.join(app.getPath('userData'), 'config.json')

  // マイグレーション: 旧ファイルが存在し新ファイルが無ければ移行する
  try {
    if (existsSync(oldCachePath) && !existsSync(cachePath)) {
      try {
        const raw = await fs.readFile(oldCachePath, 'utf-8')
        try {
          const parsed = JSON.parse(raw)
          await fs.writeFile(cachePath, JSON.stringify(parsed, null, 2), 'utf-8')
        } catch (e) {
          // 旧ファイルが厳密な JSON でない場合は生データを `_legacy` に格納して保存
          await fs.writeFile(cachePath, JSON.stringify({ _legacy: raw }, null, 2), 'utf-8')
        }
      } catch (e) {
        console.error('Failed to migrate manicashe.json to config.json:', e)
      }
    }
  } catch (e) {
    console.error('Error checking cache migration paths:', e)
  }

  ipcMain.handle('read-cache', async () => {
    try {
      const data = await fs.readFile(cachePath, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      return null
    }
  })

  ipcMain.handle('write-cache', async (_, d) => {
    try {
      await fs.writeFile(cachePath, JSON.stringify(d, null, 2), 'utf-8')
      return true
    } catch (e) {
      console.error('Failed to write config.json:', e)
      return false
    }
  })
  ipcMain.handle('set-menu-checked', (_, id, c) => { const m = Menu.getApplicationMenu(); if (m) { const i = m.getMenuItemById(id); if (i) i.checked = c; } })
  ipcMain.handle('get-system-fonts', () => systemFonts)
  ipcMain.handle('select-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (!canceled && filePaths.length > 0) {
      return filePaths[0]
    }
    return null
  })
  ipcMain.handle('open-new-window', (_, p) => createWindow(false, p))
  ipcMain.handle('is-binary-file', async (_, p) => {
    try {
      const fd = await fs.open(p, 'r');
      const { buffer } = await fd.read(Buffer.alloc(8192), 0, 8192, 0);
      await fd.close();
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to check if file is binary:', e);
      return false;
    }
  })
  // テーマ管理用のIPC ハンドラー
  const getThemeFilePath = () => path.join(app.getPath('userData'), 'mani_theme.json')
  ipcMain.handle('theme:read-themes', async () => {
    try {
      const filePath = getThemeFilePath()
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      return null
    }
  })
  ipcMain.handle('theme:save-themes', async (_, themes) => {
    try {
      const filePath = getThemeFilePath()
      await fs.writeFile(filePath, JSON.stringify(themes, null, 2), 'utf-8')
      return true
    } catch (e) {
      console.error('Failed to save themes:', e)
      return false
    }
  })
  ipcMain.handle('get-clipboard-text', async () => {
    try {
      return clipboard.readText()
    } catch (e) {
      console.error('Failed to read clipboard:', e)
      return ''
    }
  })
  // ウィンドウコントロールのIPC ハンドラー
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.minimize()
    }
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) {
        win.restore()
        return false
      } else {
        win.maximize()
        return true
      }
    }
    return false
  })
  ipcMain.handle('window:restore', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.restore()
    }
  })
  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })

  // 見出し設定管理用のIPC ハンドラー
  const getHeadingFilePath = () => path.join(app.getPath('userData'), 'headings.json')
  ipcMain.handle('heading:read', async () => {
    try {
      const filePath = getHeadingFilePath()
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      return null
    }
  })
  ipcMain.handle('heading:save', async (_, headings) => {
    try {
      const filePath = getHeadingFilePath()
      await fs.writeFile(filePath, JSON.stringify(headings, null, 2), 'utf-8')
      return true
    } catch (e) {
      console.error('Failed to save headings:', e)
      return false
    }
  })

  loadSystemFonts()

  const filePath = getFilePathFromArgs()
  if (filePath) {
    createWindow(false, filePath)
  } else {
    createWindow()
  }
})
