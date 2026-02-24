import { useState, useEffect, useCallback } from 'react';
import { readConfig, writeConfig, getDefaultPath } from '../lib/tauri-api';

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
  const updateSettings = useCallback(
    (typeOrSettings: string | Partial<EditorSettings>, data?: any) => {
      if (typeof typeOrSettings === 'object') {
        setSettings((prev) => ({ ...prev, ...typeOrSettings }));
      } else {
        const type = typeOrSettings;
        switch (type) {
          case 'set-theme':
            setSettings((prev) => ({ ...prev, theme: data }));
            // setMenuChecked is N/A in Tauri (frameless React menu)
            break;
          case 'set-font-size':
            setSettings((prev) => ({ ...prev, fontSize: Number(data) }));
            break;
          case 'set-font-family':
            setSettings((prev) => ({ ...prev, fontFamily: data }));
            break;
          case 'set-line-numbers':
            setSettings((prev) => ({ ...prev, lineNumbers: data ? 'on' : 'off' }));
            break;
          case 'set-ruler':
            setSettings((prev) => ({ ...prev, showRuler: !!data }));
            break;
          case 'set-auto-indent':
            setSettings((prev) => ({ ...prev, autoIndent: !!data }));
            break;
          case 'set-word-wrap':
            setSettings((prev) => ({
              ...prev,
              wordWrap: typeof data === 'boolean' ? (data ? 'on' : 'off') : data,
            }));
            break;
          case 'set-ruler-position': {
            const newPos = Number(data);
            setSettings((prev) => ({ ...prev, rulerPosition: newPos }));
            break;
          }
          case 'set-typewriter-mode':
            setSettings((prev) => ({ ...prev, typewriterMode: !!data }));
            break;
          case 'set-highlight-dialogue':
            setSettings((prev) => ({ ...prev, highlightDialogue: !!data }));
            break;
          case 'set-show-outline':
            setSettings((prev) => ({ ...prev, showOutline: !!data }));
            break;
          case 'set-minimap':
            setSettings((prev) => ({ ...prev, showMinimap: !!data }));
            break;
          case 'set-line-height':
            setSettings((prev) => ({ ...prev, lineHeight: Number(data) }));
            break;
          case 'set-ruler-offset':
            setSettings((prev) => ({ ...prev, rulerOffset: Number(data) }));
            break;
          case 'set-default-storage-path':
            setSettings((prev) => ({ ...prev, defaultStoragePath: data }));
            break;
          case 'set-render-whitespace':
            setSettings((prev) => ({ ...prev, renderWhitespace: !!data }));
            break;
          case 'set-genkoyoushi-mode':
            setSettings((prev) => ({ ...prev, showGenkoyoushiMode: !!data }));
            break;
          case 'set-outline-width':
            setSettings((prev) => ({ ...prev, outlineWidth: Number(data) }));
            break;
          case 'set-auto-save':
            setSettings((prev) => ({ ...prev, enableAutoSave: !!data }));
            break;
          case 'set-restore-last-file':
            setSettings((prev) => ({ ...prev, restoreLastFile: !!data }));
            break;
          case 'set-show-ruby-toolbar':
            setSettings((prev) => ({ ...prev, showRubyToolbar: !!data }));
            break;
          case 'set-show-markdown-toolbar':
            setSettings((prev) => ({ ...prev, showMarkdownToolbar: !!data }));
            break;
          case 'set-preview-mode':
            setSettings((prev) => ({ ...prev, previewMode: data }));
            break;
          case 'set-vertical-chars':
            setSettings((prev) => ({ ...prev, verticalCharsPerLine: Number(data) }));
            break;
          case 'set-vertical-kinsoku':
            setSettings((prev) => ({ ...prev, verticalKinsoku: !!data }));
            break;
          case 'set-vertical-font':
            setSettings((prev) => ({ ...prev, verticalFontFamily: data }));
            break;
          case 'set-vertical-font-size':
            setSettings((prev) => ({ ...prev, verticalFontSize: Number(data) }));
            break;
        }
      }
    },
    []
  );

  // 起動時の復元処理
  useEffect(() => {
    const restoreState = async () => {
      const cache = await readConfig();
      if (cache) {
        const loadedSettings: Partial<EditorSettings> = {};
        if (cache.theme) loadedSettings.theme = cache.theme as string;
        if (cache.fontSize) loadedSettings.fontSize = cache.fontSize as number;
        if (cache.fontFamily) loadedSettings.fontFamily = cache.fontFamily as string;
        if (cache.lineNumbers) loadedSettings.lineNumbers = cache.lineNumbers as 'on' | 'off';
        if (cache.showRuler !== undefined) loadedSettings.showRuler = cache.showRuler as boolean;
        if (cache.autoIndent !== undefined) loadedSettings.autoIndent = cache.autoIndent as boolean;
        if (cache.wordWrap)
          loadedSettings.wordWrap = cache.wordWrap as 'off' | 'on' | 'wordWrapColumn';
        if (cache.rulerPosition !== undefined)
          loadedSettings.rulerPosition = cache.rulerPosition as number;
        if (cache.typewriterMode !== undefined)
          loadedSettings.typewriterMode = cache.typewriterMode as boolean;
        if (cache.highlightDialogue !== undefined)
          loadedSettings.highlightDialogue = cache.highlightDialogue as boolean;
        if (cache.showOutline !== undefined)
          loadedSettings.showOutline = cache.showOutline as boolean;
        if (cache.showMinimap !== undefined)
          loadedSettings.showMinimap = cache.showMinimap as boolean;
        if (cache.lineHeight !== undefined) loadedSettings.lineHeight = cache.lineHeight as number;
        if (cache.rulerOffset !== undefined)
          loadedSettings.rulerOffset = cache.rulerOffset as number;
        if (cache.defaultStoragePath) {
          loadedSettings.defaultStoragePath = cache.defaultStoragePath as string;
        } else {
          loadedSettings.defaultStoragePath = await getDefaultPath();
        }
        if (cache.renderWhitespace !== undefined)
          loadedSettings.renderWhitespace = cache.renderWhitespace as boolean;
        if (cache.showGenkoyoushiMode !== undefined)
          loadedSettings.showGenkoyoushiMode = cache.showGenkoyoushiMode as boolean;
        if (cache.outlineWidth !== undefined)
          loadedSettings.outlineWidth = cache.outlineWidth as number;
        if (cache.enableAutoSave !== undefined)
          loadedSettings.enableAutoSave = cache.enableAutoSave as boolean;
        if (cache.restoreLastFile !== undefined)
          loadedSettings.restoreLastFile = cache.restoreLastFile as boolean;
        if (cache.showRubyToolbar !== undefined)
          loadedSettings.showRubyToolbar = cache.showRubyToolbar as boolean;
        if (cache.showMarkdownToolbar !== undefined)
          loadedSettings.showMarkdownToolbar = cache.showMarkdownToolbar as boolean;
        if (cache.previewMode)
          loadedSettings.previewMode = cache.previewMode as 'markdown' | 'vertical';
        if (cache.verticalCharsPerLine)
          loadedSettings.verticalCharsPerLine = cache.verticalCharsPerLine as number;
        if (cache.verticalKinsoku !== undefined)
          loadedSettings.verticalKinsoku = cache.verticalKinsoku as boolean;
        if (cache.verticalFontFamily)
          loadedSettings.verticalFontFamily = cache.verticalFontFamily as string;
        if (cache.verticalFontSize)
          loadedSettings.verticalFontSize = cache.verticalFontSize as number;
        setSettings((prev) => ({ ...prev, ...loadedSettings }));
        setIsInitialized(true);
      } else {
        const defaultPath = await getDefaultPath();
        setSettings((prev) => ({ ...prev, defaultStoragePath: defaultPath }));
        setIsInitialized(true);
      }
    };
    restoreState();
  }, []);

  // 設定の保存
  useEffect(() => {
    if (!isInitialized) return;
    const saveState = async () => {
      const prevCache = (await readConfig()) || {};
      const newCache = { ...prevCache, ...settings };
      await writeConfig(newCache as Record<string, unknown>);
    };
    saveState();
  }, [settings, isInitialized]);

  // メニューイベントの監視（Tauriではカスタム MenuBar コンポーネントが onMenuClick コールバックで処理するため
  // このフックではリスナーは設けない。App.tsx 側で updateSettings を直接呼ぶ）

  return { settings, updateSettings, isInitialized };
}
