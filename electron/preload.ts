import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (content: string, filePath?: string, forceDialog?: boolean, encoding?: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS', isNewFile?: boolean) => ipcRenderer.invoke('save-file', content, filePath, forceDialog, encoding, isNewFile),
    readFile: (filePath: string, encoding?: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS') => ipcRenderer.invoke('read-file', filePath, encoding),
    getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
    onMenuClick: (callback: (event: unknown, type: string, data?: any) => void) => {
        const s = (_e: any, t: string, d?: any) => callback(_e, t, d)
        ipcRenderer.on('menu-click', s)
        return () => ipcRenderer.removeListener('menu-click', s)
    },
    onWindowMaximize: (callback: (event: unknown, maximized: boolean) => void) => {
        const s = (_e: any, v: boolean) => callback(_e, v)
        ipcRenderer.on('window-maximized', s)
        return () => ipcRenderer.removeListener('window-maximized', s)
    },
    onAutoSaveCheck: (callback: (event: unknown, action: 'open' | 'quit') => void) => {
        const s = (_e: any, a: 'open' | 'quit') => callback(_e, a)
        ipcRenderer.on('check-autosave', s)
        return () => ipcRenderer.removeListener('check-autosave', s)
    },
    confirmAction: (action: 'open' | 'quit') => ipcRenderer.invoke('confirm-action', action),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    createNewWindow: () => ipcRenderer.invoke('create-new-window'),
    getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
    getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
    joinPath: (...paths: string[]) => ipcRenderer.invoke('join-path', ...paths),
    readCache: () => ipcRenderer.invoke('read-cache'),
    writeCache: (data: any) => ipcRenderer.invoke('write-cache', data),
    setMenuChecked: (id: string, checked: boolean) => ipcRenderer.invoke('set-menu-checked', id, checked),
    getHistoryFiles: () => ipcRenderer.invoke('history:get-files'),
    getHistorySnapshots: (filePath: string) => ipcRenderer.invoke('history:get-snapshots', filePath),
    getSnapshotContent: (hash: string) => ipcRenderer.invoke('history:get-content', hash),
    getSnapshotDiff: (oldId: number, newId: number) => ipcRenderer.invoke('history:get-diff', oldId, newId),
    deleteHistoryFile: (fileId: number) => ipcRenderer.invoke('history:delete-file', fileId),
    getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
    openNewWindow: (filePath: string) => ipcRenderer.invoke('open-new-window', filePath),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    isBinaryFile: (filePath: string) => ipcRenderer.invoke('is-binary-file', filePath),
    readThemes: () => ipcRenderer.invoke('theme:read-themes'),
    saveThemes: (themes: any) => ipcRenderer.invoke('theme:save-themes', themes),
    readHeadings: () => ipcRenderer.invoke('heading:read'),
    saveHeadings: (headings: any) => ipcRenderer.invoke('heading:save', headings),
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    restoreWindow: () => ipcRenderer.invoke('window:restore'),
    getWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
})
