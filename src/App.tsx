import React, { useEffect, useState, useRef } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import {
  openFileDialog,
  getClipboardText,
  isBinaryFile,
  readConfig,
  writeConfig,
  readHeadings,
  saveHeadings,
} from './lib/tauri-api';
import { useTauriWindow, useTauriCloseRequest } from './hooks/useTauriWindow';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import StatusBar from './components/StatusBar';
import { useEditorSettings } from './hooks/useEditorSettings';
import { useFileOperations } from './hooks/useFileOperations';
import HistoryPage from './components/History/HistoryPage';
import SettingsPage from './components/Settings/SettingsPage';
import Outline, { OutlineItem } from './components/Outline/Outline';
import MenuBar from './components/MenuBar';
import MarkdownPreview from './components/MarkdownPreview/MarkdownPreview';
import ToolBar from './components/ToolBar';

// Monaco Web Worker 設定（Vite ?worker でバンドル）
window.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};
// バンドル済み monaco インスタンスを @monaco-editor/react に渡す（CDN ロード不要）
loader.config({ monaco });

interface EditorStats {
  lines: number;
  chars: number;
  currentLineChars: number;
  line: number;
  column: number;
  selectedChars: number;
}

function App() {
  const [code, setCode] = useState('');
  const [view, setView] = useState<'editor' | 'history' | 'settings'>('editor');
  const [stats, setStats] = useState<EditorStats>({
    lines: 1,
    chars: 0,
    currentLineChars: 0,
    line: 1,
    column: 1,
    selectedChars: 0,
  });
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [headingSettings, setHeadingSettings] = useState<{ head: string; level: number }[]>([]);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null); // 保存時刻
  const [isPreviewVisible, setIsPreviewVisible] = useState(false); // Markdownプレビューの表示状態
  const [previewWidth, setPreviewWidth] = useState(50); // プレビュー幅（%）
  const [isResizing, setIsResizing] = useState(false); // リサイズ中フラグ

  const { settings, updateSettings } = useEditorSettings();
  const {
    currentPath,
    setIsDirty,
    saveFile,
    createNew,
    openFile,
    checkAutoFirstSave,
    isDirtyRef,
    codeRef,
    cursorPositionRef,
    currentEncoding,
    onFileSaved,
  } = useFileOperations(code, setCode, settings.restoreLastFile);
  const { close: tauriClose } = useTauriWindow();

  const addRubyActions = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor')
  ): monaco.IDisposable[] => {
    // 右クリックメニューにルビ挿入アクションを追加
    const d1 = editor.addAction({
      id: 'insert-ruby',
      label: 'ルビを挿入',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR],
      contextMenuGroupId: 'context_ruby',
      contextMenuOrder: 1,
      run: function (ed: monaco.editor.IStandaloneCodeEditor) {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!model || !selection) return;

        const selectedText = model.getValueInRange(selection);

        if (selectedText) {
          // 文字が選択されている場合：|選択文字《》の形式を挿入
          const rubyFormat = `|${selectedText}《》`;
          const startLineNumber = selection.startLineNumber;
          const startColumn = selection.startColumn;

          ed.executeEdits('insert-ruby', [
            {
              range: selection,
              text: rubyFormat,
              forceMoveMarkers: true,
            },
          ]);

          // カーソルを《》の間に移動（《の直後）
          setTimeout(() => {
            const newPosition = {
              lineNumber: startLineNumber,
              column: startColumn + selectedText.length + 2, // |と選択文字とルビ記号分
            };
            ed.setPosition(newPosition);
          }, 0);
        } else {
          // 文字が選択されていない場合：|《》を挿入し、|《の間にカーソルを移動
          const position = ed.getPosition();
          if (!position) return;

          ed.executeEdits('insert-ruby-empty', [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: '|《》',
              forceMoveMarkers: true,
            },
          ]);

          // カーソルを|《の間に移動（|の直後）
          setTimeout(() => {
            const newPosition = {
              lineNumber: position.lineNumber,
              column: position.column + 1,
            };
            ed.setPosition(newPosition);
          }, 0);
        }
      },
    });

    // 右クリックメニューに傍点挿入アクションを追加
    const d2 = editor.addAction({
      id: 'insert-dot',
      label: '傍点を挿入',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyP],
      contextMenuGroupId: 'context_ruby',
      contextMenuOrder: 2,
      run: function (ed: monaco.editor.IStandaloneCodeEditor) {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!model || !selection) return;

        const selectedText = model.getValueInRange(selection);

        if (selectedText) {
          // 文字が選択されている場合：各文字を|文《・》の形式に変換
          const dotFormat = selectedText
            .split('')
            .map((char: string) => `|${char}《・》`)
            .join('');
          const startLineNumber = selection.startLineNumber;
          const startColumn = selection.startColumn;

          ed.executeEdits('insert-dot', [
            {
              range: selection,
              text: dotFormat,
              forceMoveMarkers: true,
            },
          ]);

          // カーソルを最後の》の後に移動
          setTimeout(() => {
            const newPosition = {
              lineNumber: startLineNumber,
              column: startColumn + dotFormat.length,
            };
            ed.setPosition(newPosition);
          }, 0);
        } else {
          // 文字が選択されていない場合：|《・》を挿入し、|《の間にカーソルを移動
          const position = ed.getPosition();
          if (!position) return;

          ed.executeEdits('insert-dot-empty', [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: '|《・》',
              forceMoveMarkers: true,
            },
          ]);

          // カーソルを|《の間に移動（|の直後）
          setTimeout(() => {
            const newPosition = {
              lineNumber: position.lineNumber,
              column: position.column + 1,
            };
            ed.setPosition(newPosition);
          }, 0);
        }
      },
    });

    return [d1, d2];
  };

  // エディタ状態フラグ（起動時チェックに使用）
  const [isEditorReady, setIsEditorReady] = useState(false);

  // ルビツールバー設定変更時に右クリックメニューを更新
  // 設定またはエディタ準備完了時に右クリックメニューのルビ項目を更新
  useEffect(() => {
    if (!isEditorReady) return;
    if (editorRef.current && monacoRef.current) {
      // 既存のアクションがあれば dispose してから再登録（安全に更新する）
      if (rubyActionDisposablesRef.current) {
        rubyActionDisposablesRef.current.forEach((d) => {
          try {
            d.dispose();
          } catch {
            /* ignore */
          }
        });
        rubyActionDisposablesRef.current = null;
      }
      if (settings.showRubyToolbar) {
        rubyActionDisposablesRef.current = addRubyActions(editorRef.current, monacoRef.current);
      }
    }
  }, [settings.showRubyToolbar, isEditorReady]);

  // ファイル保存時のコールバック
  useEffect(() => {
    if (!onFileSaved) return;
    const unsubscribe = onFileSaved(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSaveTime(timeStr);
    });
    return () => unsubscribe();
  }, [onFileSaved]);

  // ファイルを新規作成したときはタイムスタンプをリセット
  useEffect(() => {
    if (!currentPath) {
      setLastSaveTime(null);
    }
  }, [currentPath]);

  // currentPath の変更を config に通知
  useEffect(() => {
    if (!currentPath) return;
    const updateCacheWithPath = async () => {
      const prevCache = (await readConfig()) || {};
      const newCache: Record<string, unknown> = { ...prevCache, lastFile: currentPath };
      const lastSeparator = Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf('/'));
      if (lastSeparator !== -1) {
        newCache.lastDir = currentPath.substring(0, lastSeparator);
      }
      await writeConfig(newCache);
    };
    updateCacheWithPath();
  }, [currentPath]);

  // キャッシュからプレビュー幅を読み込む
  useEffect(() => {
    const loadPreviewWidth = async () => {
      const cache = (await readConfig()) || {};
      if (cache.previewWidth && typeof cache.previewWidth === 'number') {
        setPreviewWidth(cache.previewWidth);
      }
    };
    loadPreviewWidth();
  }, []);

  // プレビュー幅がキャッシュに保存される
  useEffect(() => {
    const savePreviewWidth = async () => {
      const prevCache = (await readConfig()) || {};
      const newCache = { ...prevCache, previewWidth };
      await writeConfig(newCache);
    };
    savePreviewWidth();
  }, [previewWidth]);

  // キャッシュからMarkdownプレビュー表示状態を読み込む
  useEffect(() => {
    const loadPreviewVisibility = async () => {
      const cache = (await readConfig()) || {};
      if (cache.isPreviewVisible !== undefined && typeof cache.isPreviewVisible === 'boolean') {
        setIsPreviewVisible(cache.isPreviewVisible);
      }
    };
    loadPreviewVisibility();
  }, []);

  // Markdownプレビュー表示状態がキャッシュに保存される
  useEffect(() => {
    const savePreviewVisibility = async () => {
      const prevCache = (await readConfig()) || {};
      const newCache = { ...prevCache, isPreviewVisible };
      await writeConfig(newCache);
    };
    savePreviewVisibility();
  }, [isPreviewVisible]);

  // 見出し設定を読み込む
  useEffect(() => {
    const loadHeadings = async () => {
      let headings = (await readHeadings()) as { head: string; level: number }[] | null;
      if (!headings || !Array.isArray(headings) || headings.length === 0) {
        // デフォルト設定
        headings = [
          { head: '^第[0-9０-９一二三四五六七八九十百千万]+章', level: 1 },
          { head: '^第[0-9０-９一二三四五六七八九十百千万]+話', level: 2 },
          { head: '^第[0-9０-９一二三四五六七八九十百千万]+条', level: 1 },
          { head: '^第[0-9０-９一二三四五六七八九十百千万]+項', level: 2 },
          { head: '^第[0-9０-９一二三四五六七八九十百千万]+号', level: 3 },
        ];
        await saveHeadings(headings);
      }
      setHeadingSettings(headings);
    };
    loadHeadings();
  }, []);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const rubyActionDisposablesRef = useRef<monaco.IDisposable[] | null>(null);

  // 見出し抽出ロジック（デバウンス付き）
  useEffect(() => {
    const updateOutline = () => {
      const items: OutlineItem[] = [];
      if (!code) {
        setOutlineItems([]);
        return;
      }
      // 改行コード（\r\n または \n）で分割
      const lines = code.split(/\r?\n/);

      // 設定された正規表現リストを作成
      const headingRegexes = headingSettings.map((s) => ({
        regex: new RegExp(s.head),
        level: s.level,
      }));

      lines.forEach((line, index) => {
        // 1. カスタム見出しパターンのチェック
        let matched = false;
        for (const setting of headingRegexes) {
          if (setting.regex.test(line)) {
            items.push({
              level: setting.level,
              label: line.trim(),
              line: index + 1,
            });
            matched = true;
            break;
          }
        }

        // 2. マッチしなかった場合、標準モード（# 見出し）を抽出
        if (!matched) {
          const match = line.match(/^\s*(#{1,6})(.*)$/);
          if (match) {
            const level = match[1].length;
            const label = match[2].trim();
            items.push({
              level,
              label: label || `(レベル ${level} の見出し)`,
              line: index + 1,
            });
          }
        }
      });
      setOutlineItems(items);
    };

    const timer = setTimeout(updateOutline, 150);
    return () => clearTimeout(timer);
  }, [code, headingSettings]);

  const handleBeforeMount = (monaco: any) => {
    // カスタム言語の登録
    monaco.languages.register({ id: 'kotoori-text' });
    monaco.languages.setMonarchTokensProvider('kotoori-text', {
      tokenizer: {
        root: [
          [/「/, { token: 'custom-dialogue', next: '@dialogue_kagi' }],
          [/『/, { token: 'custom-dialogue', next: '@dialogue_double_kagi' }],
          [/【/, { token: 'custom-dialogue', next: '@dialogue_sumi' }],
          [/〈/, { token: 'custom-dialogue', next: '@dialogue_yama' }],
          [/《/, { token: 'custom-dialogue', next: '@dialogue_double_yama' }],
          [/（/, { token: 'custom-dialogue', next: '@dialogue_maru_full' }],
          [/\(/, { token: 'custom-dialogue', next: '@dialogue_maru_half' }],
          [/｛/, { token: 'custom-dialogue', next: '@dialogue_nami_full' }],
          [/\{/, { token: 'custom-dialogue', next: '@dialogue_nami_half' }],
          [/［/, { token: 'custom-dialogue', next: '@dialogue_kaku_full' }],
          [/\[/, { token: 'custom-dialogue', next: '@dialogue_kaku_half' }],
          [/”/, { token: 'custom-dialogue', next: '@dialogue_double_quote_full' }],
          [/“/, { token: 'custom-dialogue', next: '@dialogue_double_quote_start' }],
          [/’/, { token: 'custom-dialogue', next: '@dialogue_single_quote_full' }],
          [/‘/, { token: 'custom-dialogue', next: '@dialogue_single_quote_start' }],
          [/\w['’]\w/, ''], // 所有格などの単語内アポストロフィを無視
          [/"/, { token: 'custom-dialogue', next: '@dialogue_double_quote_half' }],
          [/'/, { token: 'custom-dialogue', next: '@dialogue_single_quote_half' }],
        ],
        dialogue_kagi: [
          [/」/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_double_kagi: [
          [/』/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_sumi: [
          [/】/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_yama: [
          [/〉/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_double_yama: [
          [/》/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_maru_full: [
          [/）/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_maru_half: [
          [/\)/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_nami_full: [
          [/｝/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_nami_half: [
          [/\}/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_kaku_full: [
          [/］/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_kaku_half: [
          [/\]/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_double_quote_full: [
          [/”/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_double_quote_start: [
          [/”/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_single_quote_full: [
          [/’/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_single_quote_start: [
          [/’/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_double_quote_half: [
          [/"/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
        dialogue_single_quote_half: [
          [/'/, 'custom-dialogue', '@pop'],
          [/./, 'custom-dialogue'],
        ],
      },
    });

    // テーマ定義
    monaco.editor.defineTheme('organic-note', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '#563C30' },
        { token: 'keyword', foreground: '#7A6F44' },
        { token: 'string', foreground: '#B56946' },
        { token: 'comment', foreground: '#A5A58D' },
        { token: 'type', foreground: '#6B8080' },
        { token: 'function', foreground: '#6B8080' },
        { token: 'custom-dialogue', foreground: '#B79E88' },
      ],
      colors: {
        'editor.background': '#F7D9B3',
        'editor.foreground': '#563C30',
        'editor.selectionBackground': '#F6D6BA',
        'editorLineNumber.foreground': '#A08674',
        'editorCursor.foreground': '#563C30',
      },
    });

    monaco.editor.defineTheme('moonlight', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E0E4F5' },
        { token: 'keyword', foreground: 'C099FF' },
        { token: 'string', foreground: 'F4D58D' },
        { token: 'comment', foreground: '636985' },
        { token: 'type', foreground: '82AAFF' },
        { token: 'function', foreground: '82AAFF' },
        { token: 'custom-dialogue', foreground: '82AAFF' },
      ],
      colors: {
        'editor.background': '#1A1B26',
        'editor.foreground': '#A9B1D6',
        'editor.selectionBackground': '#2F334D',
        'editorLineNumber.foreground': '#444B6A',
        'editorCursor.foreground': '#C9B27A',
      },
    });

    monaco.editor.defineTheme('nagaragawa', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '#004D40' },
        { token: 'keyword', foreground: '#01579B' },
        { token: 'string', foreground: '#0288D1' },
        { token: 'comment', foreground: '#90A4AE' },
        { token: 'type', foreground: '#00838F' },
        { token: 'function', foreground: '#00838F' },
        { token: 'custom-dialogue', foreground: '#0288D1' },
      ],
      colors: {
        'editor.background': '#F1F8E9',
        'editor.foreground': '#004D40',
        'editor.selectionBackground': '#81D4FA',
        'editorLineNumber.foreground': '#90A4AE',
        'editorCursor.foreground': '#03A9F4',
      },
    });

    monaco.editor.defineTheme('katana', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E0E0E0' },
        { token: 'keyword', foreground: 'D4AF37' },
        { token: 'string', foreground: 'B22222' },
        { token: 'comment', foreground: '757575' },
        { token: 'type', foreground: 'B0C4DE' },
        { token: 'function', foreground: 'B0C4DE' },
        { token: 'custom-dialogue', foreground: '#935A5A' },
      ],
      colors: {
        'editor.background': '#262626',
        'editor.foreground': '#E0E0E0',
        'editor.selectionBackground': '#3C4C55',
        'editorLineNumber.foreground': '#757575',
        'editorCursor.foreground': '#D4AF37',
      },
    });

    // Dark/Light にも追加
    monaco.editor.defineTheme('vs-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ token: 'custom-dialogue', foreground: 'CE9178' }],
      colors: {},
    });
    monaco.editor.defineTheme('light-custom', {
      base: 'vs',
      inherit: true,
      rules: [{ token: 'custom-dialogue', foreground: '1a5fb4' }],
      colors: {},
    });
  };
  const typewriterModeRef = useRef(settings.typewriterMode);

  useEffect(() => {
    typewriterModeRef.current = settings.typewriterMode;
  }, [settings.typewriterMode]);

  useEffect(() => {
    setStats((prev) => ({ ...prev, lines: code.split('\n').length, chars: code.length }));
  }, [code]);
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      editorRef.current.updateOptions({
        lineNumbers: settings.lineNumbers,
        rulers: [],
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        autoIndent: settings.autoIndent ? 'full' : 'none',
        wordWrap: settings.wordWrap,
        wordWrapColumn: settings.showRuler ? undefined : settings.rulerPosition,
        lineHeight: settings.fontSize * settings.lineHeight,
      });
    }
  }, [settings]);
  useEffect(() => {
    document.title = currentPath
      ? `Kotoori - ${currentPath.split(/[/\\]/).pop()} `
      : 'Kotoori - 新しいテキスト';
  }, [currentPath]);

  // ========================
  // メニューアクション関数の定義
  // ========================

  // ファイル系メニュー
  const handleNewFile = async () => {
    // Tauriでは新規ウィンドウの代わりに現在のウィンドウで新規作成
    await createNew();
  };

  const handleOpenFile = async (filePath: string) => {
    if (!currentPath && !isDirtyRef.current && codeRef.current === '') {
      await openFile(filePath);
    } else {
      // Tauriでは新規ウィンドウは未サポートのため同一ウィンドウで開く
      await openFile(filePath);
    }
    setView('editor');
  };

  const handleOpenFileDialog = async () => {
    await openFileDialog();
  };

  const handleSaveFile = async (forceDialog?: boolean) => {
    await saveFile(forceDialog ?? false);
  };

  const handleSaveAsEncoding = async (encoding: 'UTF-8' | 'UTF-8-BOM' | 'SHIFT-JIS') => {
    await saveFile(true, encoding);
  };

  // ビュー系メニュー
  const handleShowHistory = () => {
    setView('history');
  };

  const handleShowSettings = () => {
    setView('settings');
  };

  const handleShowEditor = () => {
    setView('editor');
  };

  // リサイザーのドラッグハンドラー
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const wrapper = document.querySelector('.editor-and-preview-wrapper') as HTMLElement;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const newEditorWidth = ((e.clientX - rect.left) / rect.width) * 100;
      const newPreviewWidth = 100 - newEditorWidth;

      // 最小幅を20%、最大幅を80%に制限
      if (newPreviewWidth >= 20 && newPreviewWidth <= 80 && newEditorWidth >= 20) {
        setPreviewWidth(newPreviewWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // エディタ操作系メニュー
  const handleFindReplace = (action: 'find' | 'replace') => {
    if (action === 'find') {
      editorRef.current?.trigger('menu', 'actions.find');
    } else if (action === 'replace') {
      editorRef.current?.trigger('menu', 'editor.action.startFindReplaceAction');
    }
  };

  // ルビの挿入
  const handleInsertRuby = () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();

    if (selection && !selection.isEmpty()) {
      // 選択文字列がある場合
      const range = selection;
      const selectedText = editor.getModel().getValueInRange(range);
      const rubyText = `|${selectedText}《》`;

      editor.executeEdits('insert-ruby', [
        {
          range: range,
          text: rubyText,
          forceMoveMarkers: true,
        },
      ]);

      // カーソルを《の次に移動
      const newPosition = new (monacoRef.current as any).Position(
        range.startLineNumber,
        range.startColumn + rubyText.length - 1
      );
      editor.setPosition(newPosition);
    } else {
      // 選択文字列がない場合
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('insert-ruby', [
          {
            range: new (monacoRef.current as any).Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: '|《》',
            forceMoveMarkers: true,
          },
        ]);

        // カーソルを|の次に移動
        const newPosition = new (monacoRef.current as any).Position(
          position.lineNumber,
          position.column + 1
        );
        editor.setPosition(newPosition);
      }
    }
  };

  // 傍点の挿入
  const handleInsertEmphasisDots = () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    const selection = editor.getSelection();

    if (selection && !selection.isEmpty()) {
      // 選択文字列がある場合
      const range = selection;
      const selectedText = model.getValueInRange(range);

      // 各文字に《・》を付ける
      const dotsText = selectedText
        .split('')
        .map((char: string) => `|${char}《・》`)
        .join('');

      editor.executeEdits('insert-emphasis-dots', [
        {
          range: range,
          text: dotsText,
          forceMoveMarkers: true,
        },
      ]);

      // カーソルを最後の》の次に移動
      const newPosition = new (monacoRef.current as any).Position(
        range.startLineNumber,
        range.startColumn + dotsText.length
      );
      editor.setPosition(newPosition);
    }
    // 選択文字列がない場合は何もしない
  };

  // Markdown挿入汎用関数
  const handleInsertMarkdown = (
    prefix: string,
    suffix: string = '',
    isLineStart: boolean = false
  ) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!model || !selection) return;

    if (isLineStart) {
      // 行頭に記号を追加
      const startLineNumber = selection.startLineNumber;
      const endLineNumber = selection.endLineNumber;
      const edits: any[] = [];

      for (let i = startLineNumber; i <= endLineNumber; i++) {
        edits.push({
          range: new monacoRef.current.Range(i, 1, i, 1),
          text: prefix,
          forceMoveMarkers: true,
        });
      }

      editor.executeEdits('insert-markdown-linestart', edits);
    } else {
      // 選択範囲を囲む
      const selectedText = model.getValueInRange(selection);
      const newText = `${prefix}${selectedText}${suffix}`;

      editor.executeEdits('insert-markdown-wrap', [
        {
          range: selection,
          text: newText,
          forceMoveMarkers: true,
        },
      ]);

      if (selection.isEmpty()) {
        // カーソルを囲みの内側に移動
        const newPosition = {
          lineNumber: selection.startLineNumber,
          column: selection.startColumn + prefix.length,
        };
        editor.setPosition(newPosition);
      }
    }
    editor.focus();
  };

  // 統合メニュー処理関数
  const handleMenuClick = async (type: string, data?: any) => {
    if (type === 'open') {
      await handleOpenFileDialog();
    } else if (type === 'open-candidate') {
      await handleOpenFile(data as string);
    } else if (type === 'new') {
      await handleNewFile();
    } else if (type === 'save') {
      await handleSaveFile(false);
    } else if (type === 'save-as') {
      await handleSaveFile(true);
    } else if (type === 'save-as-encoding') {
      await handleSaveAsEncoding(data);
    } else if (type === 'open-as-encoding') {
      // 現在開いているファイルを指定のエンコードで再読み込み
      if (currentPath) {
        await openFile(currentPath, data);
      }
    } else if (type === 'show-history') {
      handleShowHistory();
    } else if (type === 'show-settings') {
      handleShowSettings();
    } else if (type === 'show-editor') {
      handleShowEditor();
    } else if (type === 'find') {
      handleFindReplace('find');
    } else if (type === 'replace') {
      handleFindReplace('replace');
    }
    // 編集機能のハンドリング
    else if (type === 'undo') {
      editorRef.current?.trigger('keyboard', 'undo', null);
    } else if (type === 'redo') {
      editorRef.current?.trigger('keyboard', 'redo', null);
    } else if (type === 'cut') {
      editorRef.current?.focus();
      setTimeout(() => {
        editorRef.current?.trigger('keyboard', 'editor.action.clipboardCutAction', null);
      }, 0);
    } else if (type === 'copy') {
      editorRef.current?.focus();
      setTimeout(() => {
        editorRef.current?.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
      }, 0);
    } else if (type === 'paste') {
      editorRef.current?.focus();
      setTimeout(async () => {
        // クリップボードからテキストを取得
        const clipboardText = await getClipboardText();
        if (clipboardText) {
          // エディタに現在の選択範囲がある場合、置換する
          const editor = editorRef.current;
          if (editor) {
            const selection = editor.getSelection();
            if (selection) {
              editor.executeEdits('paste', [
                {
                  range: selection,
                  text: clipboardText,
                  forceMoveMarkers: true,
                },
              ]);
            } else {
              // 選択範囲がない場合、カーソル位置に挿入
              const position = editor.getPosition();
              if (position) {
                editor.executeEdits('paste', [
                  {
                    range: new (monacoRef.current as any).Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                    text: clipboardText,
                    forceMoveMarkers: true,
                  },
                ]);
              }
            }
          }
        }
      }, 0);
    } else if (type === 'delete') {
      editorRef.current?.trigger('keyboard', 'deleteRight', null);
    } else if (type === 'selectAll') {
      editorRef.current?.trigger('keyboard', 'editor.action.selectAll', null);
    } else if (type === 'insert-ruby') {
      handleInsertRuby();
    } else if (type === 'insert-emphasis-dots') {
      handleInsertEmphasisDots();
    } else if (type === 'set-preview') {
      setIsPreviewVisible(data);
    } else if (type === 'quit') {
      // 終了前にファイルを保存する必要がある場合
      if (isDirtyRef.current) {
        const savedPath = await saveFile();
        if (savedPath === null) {
          // 保存がキャンセルされた場合は終了しない
          return;
        }
      }
      // ウィンドウを閉じる
      await tauriClose();
    } else if (type.startsWith('set-')) {
      updateSettings(type as any, data);
    }
  };

  // Tauriウィンドウ閉じイベント: 変更がある場合は保存してから閉じる
  useTauriCloseRequest(async (): Promise<boolean> => {
    console.log(
      '[OnClose] Checking auto save before close. isDirty:',
      isDirtyRef.current,
      'currentPath:',
      currentPath
    );
    if (currentPath && isDirtyRef.current) {
      try {
        const savedPath = await saveFile();
        console.log('[OnClose] Save completed:', savedPath);
      } catch (error) {
        console.error('[OnClose] Error during save:', error);
      }
    } else if (!currentPath && isDirtyRef.current) {
      console.log('[OnClose] New file detected, skipping save');
    }
    return true; // 常に閉じることを許可
  });

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);

    // エディタにフォーカスを設定
    editor.focus();

    // カーソル位置を復元
    if (cursorPositionRef.current) {
      editor.setPosition({
        lineNumber: cursorPositionRef.current.line,
        column: cursorPositionRef.current.column,
      });
      editor.revealPositionInCenter({
        lineNumber: cursorPositionRef.current.line,
        column: cursorPositionRef.current.column,
      });
    }

    // カーソル位置の変更を記録
    editor.onDidChangeCursorPosition((e: any) => {
      cursorPositionRef.current = {
        line: e.position.lineNumber,
        column: e.position.column,
      };
    });

    // ルビ挿入コマンド（Ctrl+Alt+R）
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model || !selection) return;

      const selectedText = model.getValueInRange(selection);

      if (selectedText) {
        // 文字が選択されている場合：|選択文字《》の形式を挿入
        const rubyFormat = `|${selectedText}《》`;
        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;

        editor.executeEdits('insert-ruby', [
          {
            range: selection,
            text: rubyFormat,
            forceMoveMarkers: true,
          },
        ]);

        // カーソルを《》の間に移動（《の直後）
        setTimeout(() => {
          const newPosition = {
            lineNumber: startLineNumber,
            column: startColumn + selectedText.length + 2, // |と選択文字とルビ記号分
          };
          editor.setPosition(newPosition);
        }, 0);
      } else {
        // 文字が選択されていない場合：|《》を挿入し、|《の間にカーソルを移動
        const position = editor.getPosition();
        if (!position) return;

        editor.executeEdits('insert-ruby-empty', [
          {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: '|《》',
            forceMoveMarkers: true,
          },
        ]);

        // カーソルを|《の間に移動（|の直後）
        setTimeout(() => {
          const newPosition = {
            lineNumber: position.lineNumber,
            column: position.column + 1,
          };
          editor.setPosition(newPosition);
        }, 0);
      }
    });

    // 傍点挿入コマンド（Ctrl+Alt+P）
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyP, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model || !selection) return;

      const selectedText = model.getValueInRange(selection);

      if (selectedText) {
        // 文字が選択されている場合：各文字を|文《・》の形式に変換
        const dotFormat = selectedText
          .split('')
          .map((char) => `|${char}《・》`)
          .join('');
        const startLineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;

        editor.executeEdits('insert-dot', [
          {
            range: selection,
            text: dotFormat,
            forceMoveMarkers: true,
          },
        ]);

        // カーソルを最後の》の後に移動
        setTimeout(() => {
          const newPosition = {
            lineNumber: startLineNumber,
            column: startColumn + dotFormat.length,
          };
          editor.setPosition(newPosition);
        }, 0);
      } else {
        // 文字が選択されていない場合：|《・》を挿入し、|《の間にカーソルを移動
        const position = editor.getPosition();
        if (!position) return;

        editor.executeEdits('insert-dot-empty', [
          {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: '|《・》',
            forceMoveMarkers: true,
          },
        ]);

        // カーソルを|《の間に移動（|の直後）
        setTimeout(() => {
          const newPosition = {
            lineNumber: position.lineNumber,
            column: position.column + 1,
          };
          editor.setPosition(newPosition);
        }, 0);
      }
    });

    if (settings.showRubyToolbar) {
      rubyActionDisposablesRef.current = addRubyActions(editor, monaco);
    }

    const updateStats = () => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (position && model)
        setStats((prev) => ({
          ...prev,
          currentLineChars: model.getLineContent(position.lineNumber).length,
          line: position.lineNumber,
          column: position.column,
        }));
    };
    editor.onDidChangeCursorPosition(updateStats);
    editor.onDidChangeModelContent(updateStats);
    editor.onDidChangeCursorSelection((e: any) => {
      const model = editor.getModel();
      if (model)
        setStats((prev) => ({ ...prev, selectedChars: model.getValueInRange(e.selection).length }));
      if (typewriterModeRef.current) {
        const position = editor.getPosition();
        if (position) editor.revealLineInCenter(position.lineNumber, 1 /* Smooth */);
      }
    });
    updateStats();
  };

  const handleOutlineClick = (line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as any;
        const filePath = file.path;

        if (filePath) {
          const isBin = await isBinaryFile(filePath);
          if (isBin) {
            alert(`バイナリファイルは開けません: ${filePath.split(/[/\\]/).pop()}`);
            continue;
          }

          if (i === 0 && !currentPath) {
            // 最初のファイルかつ、現在のアプリでファイルを開いていない場合はそのまま開く
            await openFile(filePath);
          } else {
            // ファイルを開いている場合、または2つ目以降のファイルは同一ウィンドウで開く（Tauri: 新規ウィンドウ未サポート）
            await openFile(filePath);
          }
        }
      }
    }
  };

  return (
    <div
      className={`theme-${view === 'editor' ? settings.theme : settings.theme}`}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <MenuBar
        onMenuClick={handleMenuClick}
        title={
          currentPath ? `Kotoori - ${currentPath.split(/[/\\]/).pop()}` : 'Kotoori - 新しいテキスト'
        }
        theme={settings.theme}
        checkedItems={{
          'view:line-numbers': settings.lineNumbers === 'on',
          'view:minimap': settings.showMinimap,
          'view:outline': settings.showOutline,
          'view:ruby-toolbar': settings.showRubyToolbar,
          'view:markdown-toolbar': settings.showMarkdownToolbar,
          'view:word-wrap': settings.wordWrap === 'on',
          'view:preview': isPreviewVisible,
          [`theme:${settings.theme}`]: true,
          [`font-size:${settings.fontSize}`]: true,
        }}
      />
      <ToolBar
        onNew={() => handleMenuClick('new')}
        onOpen={() => handleMenuClick('open')}
        onSave={() => handleMenuClick('save')}
        onShowHistory={() => handleMenuClick('show-history')}
        showOutline={settings.showOutline}
        onToggleOutline={() => updateSettings({ showOutline: !settings.showOutline })}
        isPreviewVisible={isPreviewVisible}
        onTogglePreview={() => setIsPreviewVisible(!isPreviewVisible)}
        previewMode={settings.previewMode}
        onTogglePreviewMode={(mode) => updateSettings({ previewMode: mode })}
        onInsertRuby={() => handleMenuClick('insert-ruby')}
        onInsertEmphasisDots={() => handleMenuClick('insert-emphasis-dots')}
        onBold={() => handleInsertMarkdown('**', '**')}
        onItalic={() => handleInsertMarkdown('*', '*')}
        onHeading={() => handleInsertMarkdown('# ', '', true)}
        onLink={() => handleInsertMarkdown('[', '](url)')}
        onList={() => handleInsertMarkdown('- ', '', true)}
        onListOrdered={() => handleInsertMarkdown('1. ', '', true)}
        onQuote={() => handleInsertMarkdown('> ', '', true)}
        onCode={() => {
          const selection = editorRef.current?.getSelection();
          if (selection && selection.startLineNumber !== selection.endLineNumber) {
            handleInsertMarkdown('```\n', '\n```');
          } else {
            handleInsertMarkdown('`', '`');
          }
        }}
        showRuby={settings.showRubyToolbar}
        showMarkdown={settings.showMarkdownToolbar}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {view === 'history' ? (
          <HistoryPage
            currentPath={currentPath}
            encoding={currentEncoding}
            onRestore={(content) => {
              setCode(content);
              setIsDirty(false);
              setView('editor');
            }}
            onBack={() => setView('editor')}
          />
        ) : view === 'settings' ? (
          <SettingsPage
            settings={settings}
            updateSettings={updateSettings}
            onBack={() => setView('editor')}
            headingSettings={headingSettings}
            setHeadingSettings={setHeadingSettings}
          />
        ) : (
          <React.Fragment>
            {settings.showOutline && (
              <div className={`theme-${settings.theme}`}>
                <Outline
                  items={outlineItems}
                  settings={settings}
                  onItemClick={handleOutlineClick}
                  activeLine={stats.line}
                  width={settings.outlineWidth}
                  onWidthChange={(newWidth) => {
                    updateSettings({ outlineWidth: newWidth });
                  }}
                />
              </div>
            )}
            <div
              className={`theme-${settings.theme}`}
              style={{
                flexGrow: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                position: 'relative',
                gap: 0,
              }}
            >
              {/* エディタとプレビューのメインセクション */}
              <div
                className={`editor-and-preview-wrapper`}
                style={{
                  display: 'flex',
                  width: '100%',
                  flex: 1,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                {/* エディタセクション */}
                <div
                  style={{
                    flex: isPreviewVisible ? `1 1 ${100 - previewWidth}%` : '1 1 100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {settings.showRuler && (
                    <div
                      style={{
                        position: 'absolute',
                        left: (() => {
                          if (!editorRef.current) return 0;
                          const fontInfo = editorRef.current.getOption(
                            monacoRef.current.editor.EditorOption.fontInfo
                          );
                          const margin = settings.lineNumbers === 'on' ? 58 : 10;
                          return (
                            margin +
                            fontInfo.typicalHalfwidthCharacterWidth * settings.rulerPosition +
                            settings.rulerOffset
                          );
                        })(),
                        top: 0,
                        bottom: 0,
                        width: '1px',
                        backgroundColor: 'var(--accent-color)',
                        opacity: 0.3,
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Editor
                      height="100%"
                      width="100%"
                      language={settings.highlightDialogue ? 'kotoori-text' : 'plaintext'}
                      value={code}
                      onChange={(v) => {
                        const n = v || '';
                        setCode(n);
                        setIsDirty(true);
                        if (settings.enableAutoSave)
                          checkAutoFirstSave(n, settings.defaultStoragePath);
                      }}
                      beforeMount={handleBeforeMount}
                      onMount={handleEditorDidMount}
                      theme={
                        settings.theme === 'vs-dark'
                          ? 'vs-dark-custom'
                          : settings.theme === 'light'
                            ? 'light-custom'
                            : settings.theme
                      }
                      options={{
                        lineNumbers: settings.lineNumbers,
                        rulers: settings.showRuler ? [] : [],
                        fontSize: settings.fontSize,
                        fontFamily: settings.fontFamily,
                        autoIndent: settings.autoIndent ? 'full' : 'none',
                        wordWrap: settings.wordWrap,
                        wordWrapColumn: settings.showRuler ? undefined : settings.rulerPosition,
                        automaticLayout: true,
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        snippetSuggestions: 'none',
                        wordBasedSuggestions: 'off',
                        hover: { enabled: false },
                        renderValidationDecorations: 'off',
                        lineHeight: settings.fontSize * settings.lineHeight,
                        minimap: { enabled: settings.showMinimap },
                        renderWhitespace: settings.renderWhitespace ? 'all' : 'none',
                        renderLineHighlight: 'line',
                      }}
                    />
                  </div>
                </div>

                {/* リサイザー */}
                {isPreviewVisible && (
                  <div
                    style={{
                      width: '4px',
                      backgroundColor: 'var(--border-color)',
                      cursor: 'col-resize',
                      userSelect: 'none',
                      flex: '0 0 4px',
                      opacity: isResizing ? 0.8 : 0.3,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseDown={handleResizeMouseDown}
                  />
                )}

                {/* Markdownプレビューセクション */}
                {isPreviewVisible && (
                  <div style={{ flex: `1 1 ${previewWidth}%`, overflow: 'hidden' }}>
                    <MarkdownPreview
                      markdown={code}
                      isVisible={isPreviewVisible}
                      previewMode={settings.previewMode}
                      verticalCharsPerLine={settings.verticalCharsPerLine}
                      verticalKinsoku={settings.verticalKinsoku}
                      verticalFontFamily={settings.verticalFontFamily}
                      verticalFontSize={settings.verticalFontSize}
                      fontSize={settings.fontSize}
                      lineHeight={settings.lineHeight}
                      editorRef={editorRef}
                      currentLine={stats.line}
                    />
                  </div>
                )}
              </div>

              {/* ステータスバー */}
              <StatusBar
                line={stats.line}
                column={stats.column}
                selectedChars={stats.selectedChars}
                totalLines={stats.lines}
                totalChars={stats.chars}
                currentLineChars={stats.currentLineChars}
                autoIndent={settings.autoIndent}
                showGenkoyoushiMode={settings.showGenkoyoushiMode}
                code={code}
                encoding={currentEncoding}
                lastSaveTime={lastSaveTime}
              />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

export default App;
