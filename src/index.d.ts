export interface ElectronAPI {
  // レンダラーからメインへ保存を要求する。成功した場合、保存したパスを返す
  saveFile: (content: string, filePath?: string, forceDialog?: boolean, encoding?: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS', isNewFile?: boolean) => Promise<string | null>;
  // 指定パスのファイルを読み込む。必要なら強制エンコーディングを指定できる
  readFile: (filePath: string, encoding?: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS') => Promise<{ content: string; encoding: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS' } | null>;
  // クリップボードからテキストを読み込む
  getClipboardText: () => Promise<string>;
  // メニュークリック時のイベントリスナー
  onMenuClick: (callback: (event: unknown, type: 'open' | 'open-candidate' | 'open-as-encoding' | 'save' | 'save-as' | 'save-as-encoding' | 'find' | 'replace' | 'new' | 'set-theme' | 'set-font-size' | 'set-font-family' | 'set-line-numbers' | 'set-ruler' | 'set-auto-indent' | 'set-word-wrap' | 'set-ruler-position' | 'set-typewriter-mode' | 'set-highlight-dialogue' | 'set-show-outline' | 'set-minimap' | 'show-history' | 'show-settings' | 'show-editor' | 'insert-sample' | 'set-default-storage-path' | 'set-line-height' | 'set-ruler-offset' | 'set-restore-last-file' | 'set-show-ruby-toolbar' | 'set-show-markdown-toolbar' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete' | 'selectAll' | 'toggle-dev-tools', data?: any) => void) => () => void;
  onWindowMaximize: (callback: (event: unknown, maximized: boolean) => void) => () => void;
  // オートセーブチェックのリスナー
  onAutoSaveCheck: (callback: (event: unknown, action: 'open' | 'quit' | 'close') => void) => () => void;
  // アクションの実行許可をメインに送る
  confirmAction: (action: 'open' | 'quit' | 'close') => Promise<void>;
  openFileDialog: () => Promise<void>;
  createNewWindow: () => Promise<void>;
  // ドキュメントパスを取得
  getDocumentsPath: () => Promise<string>;
  // Kotooriデフォルトフォルダのパスを取得
  getDefaultPath: () => Promise<string>;
  // パスの結合
  joinPath: (...paths: string[]) => Promise<string>;
  // キャッシュの読み書き
  readCache: () => Promise<any>;
  writeCache: (data: any) => Promise<boolean>;
  // メニューのチェック状態を設定
  setMenuChecked: (id: string, checked: boolean) => Promise<void>;

  // History API
  getHistoryFiles: () => Promise<any[]>; // FileRecord[]
  getHistorySnapshots: (filePath: string) => Promise<any[]>; // SnapshotRecord[]
  getSnapshotContent: (hash: string) => Promise<string | null>;
  getSnapshotDiff: (oldId: number, newId: number) => Promise<{ added: number; removed: number; changes: any[] }>;
  deleteHistoryFile: (fileId: number) => Promise<void>;
  getSystemFonts: () => Promise<string[]>;
  openNewWindow: (filePath: string) => Promise<void>;
  selectFolder: () => Promise<string | null>;
  isBinaryFile: (filePath: string) => Promise<boolean>;
  // ウィンドウコントロール
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<boolean>;
  restoreWindow: () => Promise<void>;
  getWindowMaximized: () => Promise<boolean>;
  // Theme API
  readThemes: () => Promise<any | null>;
  saveThemes: (themes: any) => Promise<boolean>;
  // Heading API
  readHeadings: () => Promise<any | null>;
  saveHeadings: (headings: any) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}