import { useState, useEffect, useCallback } from 'react';

export interface EditorSettings {
    theme: string;
    fontSize: number;
    fontFamily: string;
    lineNumbers: 'on' | 'off';
    showRuler: boolean;
    autoIndent: boolean;
    wordWrap: 'off' | 'on' | 'wordWrapColumn';
    rulerPosition: number;
    typewriterMode: boolean;
    highlightDialogue: boolean;
    showOutline: boolean;
    showMinimap: boolean;
    lineHeight: number;
    rulerOffset: number;
    defaultStoragePath: string;
    renderWhitespace: boolean;
    showGenkoyoushiMode: boolean;
    outlineWidth: number;
    enableAutoSave: boolean;
    restoreLastFile: boolean;
    currentEncoding: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS';
    showRubyToolbar: boolean;
    showMarkdownToolbar: boolean;
    previewMode: 'markdown' | 'vertical';
    verticalCharsPerLine: number;
    verticalKinsoku: boolean;
    verticalFontFamily: string;
    verticalFontSize: number;
}

export function useEditorSettings() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [settings, setSettings] = useState<EditorSettings>({
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: 'Meiryo',
        lineNumbers: 'on',
        showRuler: true,
        autoIndent: true,
        wordWrap: 'on',
        rulerPosition: 80,
        typewriterMode: false,
        highlightDialogue: true,
        showOutline: true,
        showMinimap: false,
        lineHeight: 1.5,
        rulerOffset: 0,
        defaultStoragePath: '',
        renderWhitespace: false,
        showGenkoyoushiMode: false,
        outlineWidth: 250,
        enableAutoSave: true,
        restoreLastFile: true,
        currentEncoding: 'UTF-8',
        showRubyToolbar: true,
        showMarkdownToolbar: true,
        previewMode: 'markdown',
        verticalCharsPerLine: 20,
        verticalKinsoku: true,
        verticalFontFamily: 'Sawarabi Mincho',
        verticalFontSize: 14,
    });

    // 設定を更新するユーティリティ
    const updateSettings = useCallback((typeOrSettings: string | Partial<EditorSettings>, data?: any) => {
        if (typeof typeOrSettings === 'object') {
            setSettings((prev) => ({ ...prev, ...typeOrSettings }));
        } else {
            const type = typeOrSettings;
            switch (type) {
                case 'set-theme':
                    setSettings(prev => ({ ...prev, theme: data }));
                    window.electronAPI.setMenuChecked(`theme-${data}`, true);
                    break;
                case 'set-font-size':
                    setSettings(prev => ({ ...prev, fontSize: Number(data) }));
                    break;
                case 'set-font-family':
                    setSettings(prev => ({ ...prev, fontFamily: data }));
                    window.electronAPI.setMenuChecked(`font-${data}`, true);
                    break;
                case 'set-line-numbers':
                    setSettings(prev => ({ ...prev, lineNumbers: data ? 'on' : 'off' }));
                    break;
                case 'set-ruler':
                    setSettings(prev => ({ ...prev, showRuler: !!data }));
                    break;
                case 'set-auto-indent':
                    setSettings(prev => ({ ...prev, autoIndent: !!data }));
                    break;
                case 'set-word-wrap':
                    setSettings(prev => ({ ...prev, wordWrap: data }));
                    if (data === 'off') window.electronAPI.setMenuChecked('word-wrap-off', true);
                    if (data === 'on') window.electronAPI.setMenuChecked('word-wrap-on', true);
                    if (data === 'wordWrapColumn') window.electronAPI.setMenuChecked('word-wrap-column', true);
                    break;
                case 'set-ruler-position':
                    const newPos = Number(data);
                    setSettings(prev => ({ ...prev, rulerPosition: newPos }));
                    window.electronAPI.setMenuChecked(`ruler-${newPos}`, true);
                    break;
                case 'set-typewriter-mode':
                    setSettings(prev => ({ ...prev, typewriterMode: !!data }));
                    break;
                case 'set-highlight-dialogue':
                    setSettings(prev => ({ ...prev, highlightDialogue: !!data }));
                    break;
                case 'set-show-outline':
                    setSettings(prev => ({ ...prev, showOutline: !!data }));
                    window.electronAPI.setMenuChecked('show-outline-checked', !!data);
                    break;
                case 'set-minimap':
                    setSettings(prev => ({ ...prev, showMinimap: !!data }));
                    window.electronAPI.setMenuChecked('show-minimap-checked', !!data);
                    break;
                case 'set-line-height':
                    setSettings(prev => ({ ...prev, lineHeight: Number(data) }));
                    break;
                case 'set-ruler-offset':
                    setSettings(prev => ({ ...prev, rulerOffset: Number(data) }));
                    break;
                case 'set-default-storage-path':
                    setSettings(prev => ({ ...prev, defaultStoragePath: data }));
                    break;
                case 'set-render-whitespace':
                    setSettings(prev => ({ ...prev, renderWhitespace: !!data }));
                    break;
                case 'set-genkoyoushi-mode':
                    setSettings(prev => ({ ...prev, showGenkoyoushiMode: !!data }));
                    break;
                case 'set-outline-width':
                    setSettings(prev => ({ ...prev, outlineWidth: Number(data) }));
                    break;
                case 'set-auto-save':
                    setSettings(prev => ({ ...prev, enableAutoSave: !!data }));
                    break;
                case 'set-restore-last-file':
                    setSettings(prev => ({ ...prev, restoreLastFile: !!data }));
                    break;
                case 'set-show-ruby-toolbar':
                    setSettings(prev => ({ ...prev, showRubyToolbar: !!data }));
                    break;
                case 'set-show-markdown-toolbar':
                    setSettings(prev => ({ ...prev, showMarkdownToolbar: !!data }));
                    break;
                case 'set-preview-mode':
                    setSettings(prev => ({ ...prev, previewMode: data }));
                    break;
                case 'set-vertical-chars':
                    setSettings(prev => ({ ...prev, verticalCharsPerLine: Number(data) }));
                    break;
                case 'set-vertical-kinsoku':
                    setSettings(prev => ({ ...prev, verticalKinsoku: !!data }));
                    break;
                case 'set-vertical-font':
                    setSettings(prev => ({ ...prev, verticalFontFamily: data }));
                    break;
                case 'set-vertical-font-size':
                    setSettings(prev => ({ ...prev, verticalFontSize: Number(data) }));
                    break;
            }
        }
    }, []);

    // 起動時の復元処理
    useEffect(() => {
        const restoreState = async () => {
            const cache = await window.electronAPI.readCache();
            if (cache) {
                const loadedSettings: Partial<EditorSettings> = {};
                if (cache.theme) {
                    loadedSettings.theme = cache.theme;
                    window.electronAPI.setMenuChecked(`theme-${cache.theme}`, true);
                }
                if (cache.fontSize) loadedSettings.fontSize = cache.fontSize;
                if (cache.fontFamily) {
                    loadedSettings.fontFamily = cache.fontFamily;
                    window.electronAPI.setMenuChecked(`font-${cache.fontFamily}`, true);
                }
                if (cache.lineNumbers) {
                    loadedSettings.lineNumbers = cache.lineNumbers;
                    window.electronAPI.setMenuChecked('line-numbers', cache.lineNumbers === 'on');
                }
                if (cache.showRuler !== undefined) {
                    loadedSettings.showRuler = cache.showRuler;
                    window.electronAPI.setMenuChecked('ruler', cache.showRuler);
                }
                if (cache.autoIndent !== undefined) {
                    loadedSettings.autoIndent = cache.autoIndent;
                    window.electronAPI.setMenuChecked('auto-indent', cache.autoIndent);
                }
                if (cache.wordWrap) {
                    loadedSettings.wordWrap = cache.wordWrap;
                    if (cache.wordWrap === 'off') window.electronAPI.setMenuChecked('word-wrap-off', true);
                    if (cache.wordWrap === 'on') window.electronAPI.setMenuChecked('word-wrap-on', true);
                    if (cache.wordWrap === 'wordWrapColumn') window.electronAPI.setMenuChecked('word-wrap-column', true);
                }
                if (cache.rulerPosition !== undefined) {
                    loadedSettings.rulerPosition = cache.rulerPosition;
                    window.electronAPI.setMenuChecked(`ruler-${cache.rulerPosition}`, true);
                }
                if (cache.typewriterMode !== undefined) {
                    loadedSettings.typewriterMode = cache.typewriterMode;
                    window.electronAPI.setMenuChecked('typewriter-mode', cache.typewriterMode);
                }
                if (cache.highlightDialogue !== undefined) {
                    loadedSettings.highlightDialogue = cache.highlightDialogue;
                }
                if (cache.showOutline !== undefined) {
                    loadedSettings.showOutline = cache.showOutline;
                    window.electronAPI.setMenuChecked('show-outline-checked', cache.showOutline);
                }
                if (cache.showMinimap !== undefined) {
                    loadedSettings.showMinimap = cache.showMinimap;
                    window.electronAPI.setMenuChecked('show-minimap-checked', cache.showMinimap);
                }
                if (cache.lineHeight !== undefined) {
                    loadedSettings.lineHeight = cache.lineHeight;
                }
                if (cache.rulerOffset !== undefined) {
                    loadedSettings.rulerOffset = cache.rulerOffset;
                }
                if (cache.defaultStoragePath) {
                    loadedSettings.defaultStoragePath = cache.defaultStoragePath;
                } else {
                    loadedSettings.defaultStoragePath = await window.electronAPI.getDefaultPath();
                }
                if (cache.renderWhitespace !== undefined) {
                    loadedSettings.renderWhitespace = cache.renderWhitespace;
                }
                if (cache.showGenkoyoushiMode !== undefined) {
                    loadedSettings.showGenkoyoushiMode = cache.showGenkoyoushiMode;
                }
                if (cache.outlineWidth !== undefined) {
                    loadedSettings.outlineWidth = cache.outlineWidth;
                }
                if (cache.enableAutoSave !== undefined) {
                    loadedSettings.enableAutoSave = cache.enableAutoSave;
                }
                if (cache.restoreLastFile !== undefined) {
                    loadedSettings.restoreLastFile = cache.restoreLastFile;
                }
                if (cache.showRubyToolbar !== undefined) {
                    loadedSettings.showRubyToolbar = cache.showRubyToolbar;
                }
                if (cache.showMarkdownToolbar !== undefined) {
                    loadedSettings.showMarkdownToolbar = cache.showMarkdownToolbar;
                }
                if (cache.previewMode) {
                    loadedSettings.previewMode = cache.previewMode;
                }
                if (cache.verticalCharsPerLine) {
                    loadedSettings.verticalCharsPerLine = cache.verticalCharsPerLine;
                }
                if (cache.verticalKinsoku !== undefined) {
                    loadedSettings.verticalKinsoku = cache.verticalKinsoku;
                }
                if (cache.verticalFontFamily) {
                    loadedSettings.verticalFontFamily = cache.verticalFontFamily;
                }
                if (cache.verticalFontSize) {
                    loadedSettings.verticalFontSize = cache.verticalFontSize;
                }
                setSettings(prev => ({ ...prev, ...loadedSettings }));
                setIsInitialized(true);
            } else {
                const defaultPath = await window.electronAPI.getDefaultPath();
                setSettings(prev => ({ ...prev, defaultStoragePath: defaultPath }));
                setIsInitialized(true);
            }
        };
        restoreState();
    }, []);

    // 設定の保存
    useEffect(() => {
        if (!isInitialized) return; // 初期化が終わるまでは保存しない

        const saveState = async () => {
            const prevCache = await window.electronAPI.readCache() || {};
            const newCache = { ...prevCache, ...settings };
            await window.electronAPI.writeCache(newCache);
        };
        saveState();
    }, [settings, isInitialized]);

    // メニューイベントの監視
    useEffect(() => {
        const removeMenuListener = window.electronAPI.onMenuClick((_event, type, data) => {
            switch (type) {
                case 'set-theme':
                    updateSettings({ theme: data });
                    window.electronAPI.setMenuChecked(`theme-${data}`, true);
                    break;
                case 'set-font-size':
                    updateSettings({ fontSize: Number(data) });
                    break;
                case 'set-font-family':
                    updateSettings({ fontFamily: data });
                    window.electronAPI.setMenuChecked(`font-${data}`, true);
                    break;
                case 'set-line-numbers':
                    updateSettings({ lineNumbers: data ? 'on' : 'off' });
                    break;
                case 'set-ruler':
                    updateSettings({ showRuler: !!data });
                    break;
                case 'set-auto-indent':
                    updateSettings({ autoIndent: !!data });
                    break;
                case 'set-word-wrap':
                    updateSettings({ wordWrap: data });
                    // 他のラジオボタンのチェックを外すためにメインプロセスに通知
                    // Electronのradio型は一つをtrueにすれば他がfalseになるため、該当するものだけtrueにする
                    if (data === 'off') window.electronAPI.setMenuChecked('word-wrap-off', true);
                    if (data === 'on') window.electronAPI.setMenuChecked('word-wrap-on', true);
                    if (data === 'wordWrapColumn') window.electronAPI.setMenuChecked('word-wrap-column', true);
                    break;
                case 'set-ruler-position':
                    const newPos = Number(data);
                    updateSettings({ rulerPosition: newPos });
                    window.electronAPI.setMenuChecked(`ruler-${newPos}`, true);
                    break;
                case 'set-typewriter-mode':
                    updateSettings({ typewriterMode: !!data });
                    break;
                case 'set-highlight-dialogue':
                    updateSettings({ highlightDialogue: !!data });
                    break;
                case 'set-show-outline':
                    updateSettings({ showOutline: !!data });
                    window.electronAPI.setMenuChecked('show-outline-checked', !!data);
                    break;
                case 'set-minimap':
                    updateSettings({ showMinimap: !!data });
                    window.electronAPI.setMenuChecked('show-minimap-checked', !!data);
                    break;
                case 'set-line-height':
                    updateSettings({ lineHeight: Number(data) });
                    break;
                case 'set-restore-last-file':
                    updateSettings({ restoreLastFile: !!data });
                    break;
                case 'set-show-ruby-toolbar':
                    updateSettings({ showRubyToolbar: !!data });
                    break;
                case 'set-show-markdown-toolbar':
                    updateSettings({ showMarkdownToolbar: !!data });
                    break;
            }
        });

        return () => {
            removeMenuListener();
        };
    }, [updateSettings]);

    return { settings, updateSettings, isInitialized };
}
