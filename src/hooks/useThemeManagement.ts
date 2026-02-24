import { useState, useCallback, useEffect } from 'react';
import { readThemes, saveThemes } from '../lib/tauri-api';

export interface ThemeColors {
  statusBg: string;
  statusText: string;
  dialogueColor: string;
  editorBg: string;
  editorFg: string;
  sidebarBg: string;
  borderColor: string;
  itemHoverBg: string;
  itemSelectedBg: string;
  accentColor: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isCustom: boolean;
}

// デフォルトテーマ定義
export const DEFAULT_THEMES: Theme[] = [
  {
    id: 'vs-dark',
    name: '宵闇',
    isCustom: false,
    colors: {
      statusBg: '#333333',
      statusText: '#cccccc',
      dialogueColor: '#CE9178',
      editorBg: '#1e1e1e',
      editorFg: '#d4d4d4',
      sidebarBg: '#252526',
      borderColor: '#333333',
      itemHoverBg: '#2a2a2d',
      itemSelectedBg: '#37373d',
      accentColor: '#007acc',
    },
  },
  {
    id: 'light',
    name: '光明',
    isCustom: false,
    colors: {
      statusBg: '#f3f3f3',
      statusText: '#333333',
      dialogueColor: '#1a5fb4',
      editorBg: '#ffffff',
      editorFg: '#333333',
      sidebarBg: '#f3f3f3',
      borderColor: '#dddddd',
      itemHoverBg: '#e8e8e8',
      itemSelectedBg: '#cfcfcf',
      accentColor: '#007acc',
    },
  },
  {
    id: 'organic-note',
    name: '生成り色',
    isCustom: false,
    colors: {
      statusBg: '#FAF7F2',
      statusText: '#2D241E',
      dialogueColor: '#B0A495',
      editorBg: '#FAF7F2',
      editorFg: '#584B42',
      sidebarBg: '#F0EAE2',
      borderColor: '#D6CDBF',
      itemHoverBg: '#F5EFE6',
      itemSelectedBg: '#E6DDBD',
      accentColor: '#A52A2A',
    },
  },
  {
    id: 'moonlight',
    name: '月光',
    isCustom: false,
    colors: {
      statusBg: '#0F111A',
      statusText: '#A9B1D6',
      dialogueColor: '#82AAFF',
      editorBg: '#1A1B26',
      editorFg: '#A9B1D6',
      sidebarBg: '#16161E',
      borderColor: '#C9B27A',
      itemHoverBg: '#24283B',
      itemSelectedBg: '#2F334D',
      accentColor: '#C9B27A',
    },
  },
  {
    id: 'nagaragawa',
    name: '長良川',
    isCustom: false,
    colors: {
      statusBg: '#E1F5FE',
      statusText: '#01579B',
      dialogueColor: '#0288D1',
      editorBg: '#F1F8E9',
      editorFg: '#004D40',
      sidebarBg: '#E0F2F1',
      borderColor: '#0288D1',
      itemHoverBg: '#B3E5FC',
      itemSelectedBg: '#81D4FA',
      accentColor: '#03A9F4',
    },
  },
  {
    id: 'katana',
    name: '刀',
    isCustom: false,
    colors: {
      statusBg: '#262626',
      statusText: '#E0E0E0',
      dialogueColor: '#935A5A',
      editorBg: '#262626',
      editorFg: '#E0E0E0',
      sidebarBg: '#1F1F1F',
      borderColor: '#3C4C55',
      itemHoverBg: '#2D2D2D',
      itemSelectedBg: '#3C4C55',
      accentColor: '#D4AF37',
    },
  },
];

export const useThemeManagement = () => {
  const [themes, setThemes] = useState<Theme[]>(DEFAULT_THEMES);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初期化: ファイルからテーマを読み込む
  useEffect(() => {
    const initializeThemes = async () => {
      try {
        const savedThemes = await readThemes();
        if (savedThemes && Array.isArray(savedThemes) && savedThemes.length > 0) {
          // 保存されたテーマ（カスタムのみ）とデフォルトテーマをマージ
          const customThemes = savedThemes.filter((t) => t.isCustom);
          setThemes([...DEFAULT_THEMES, ...customThemes]);
        } else {
          // ファイルがない場合はデフォルトテーマのみを設定
          setThemes(DEFAULT_THEMES);
        }
      } catch (e) {
        console.error('Failed to load themes:', e);
        setThemes(DEFAULT_THEMES);
      }
      setIsInitialized(true);
    };

    initializeThemes();
  }, []);

  // テーマを取得
  const getTheme = useCallback(
    (themeId: string): Theme | undefined => {
      return themes.find((t) => t.id === themeId);
    },
    [themes]
  );

  // カスタムテーマを保存
  const saveCustomTheme = useCallback(
    async (theme: Theme): Promise<boolean> => {
      try {
        const customThemes = themes.filter((t) => t.isCustom);

        // 既存のカスタムテーマを置き換えるか、新規追加
        const themeIndex = customThemes.findIndex((t) => t.id === theme.id);

        if (themeIndex >= 0) {
          customThemes[themeIndex] = theme;
        } else {
          customThemes.push(theme);
        }

        // ファイルに保存（カスタムテーマのみ）
        await saveThemes(customThemes);

        // UI のテーマリストを更新
        const allThemes = [...DEFAULT_THEMES, ...customThemes];
        setThemes(allThemes);

        return true;
      } catch (e) {
        console.error('Failed to save theme:', e);
        return false;
      }
    },
    [themes]
  );

  // テーマを削除
  const deleteCustomTheme = useCallback(
    async (themeId: string): Promise<boolean> => {
      try {
        const customThemes = themes.filter((t) => t.isCustom && t.id !== themeId);

        await saveThemes(customThemes);

        const allThemes = [...DEFAULT_THEMES, ...customThemes];
        setThemes(allThemes);

        return true;
      } catch (e) {
        console.error('Failed to delete theme:', e);
        return false;
      }
    },
    [themes]
  );

  // CSS変数を適用
  const applyThemeColors = useCallback((colors: ThemeColors) => {
    const root = document.documentElement;
    root.style.setProperty('--status-bg', colors.statusBg);
    root.style.setProperty('--status-text', colors.statusText);
    root.style.setProperty('--dialogue-color', colors.dialogueColor);
    root.style.setProperty('--editor-bg', colors.editorBg);
    root.style.setProperty('--editor-fg', colors.editorFg);
    root.style.setProperty('--sidebar-bg', colors.sidebarBg);
    root.style.setProperty('--border-color', colors.borderColor);
    root.style.setProperty('--item-hover-bg', colors.itemHoverBg);
    root.style.setProperty('--item-selected-bg', colors.itemSelectedBg);
    root.style.setProperty('--accent-color', colors.accentColor);
  }, []);

  return {
    themes,
    isInitialized,
    getTheme,
    saveCustomTheme,
    deleteCustomTheme,
    applyThemeColors,
  };
};
