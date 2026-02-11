import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useThemeManagement, Theme, ThemeColors } from '../../hooks/useThemeManagement';
import StatusBar from '../StatusBar';
import './ThemeCustomizer.css';

interface ThemeCustomizerProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const { themes, isInitialized, getTheme, saveCustomTheme, deleteCustomTheme, applyThemeColors } = useThemeManagement();
  const [selectedTheme, setSelectedTheme] = useState<Theme | undefined>();
  const [editedColors, setEditedColors] = useState<ThemeColors | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [previewStats, setPreviewStats] = useState({
    line: 1,
    column: 1,
    selectedChars: 0,
    totalLines: 1,
    totalChars: 0,
    currentLineChars: 0,
  });

  // 選択されたテーマを更新
  React.useEffect(() => {
    const theme = getTheme(currentTheme);
    setSelectedTheme(theme);
    if (theme) {
      setEditedColors({ ...theme.colors });
      applyThemeColors(theme.colors);
    }
  }, [currentTheme, getTheme, applyThemeColors]);

  // テーマを選択
  const handleThemeSelect = (themeId: string) => {
    const theme = getTheme(themeId);
    if (theme) {
      setSelectedTheme(theme);
      setEditedColors({ ...theme.colors });
      applyThemeColors(theme.colors);
      onThemeChange(themeId);
      setDeleteConfirm(false);
    }
  };

  // 色を変更
  const handleColorChange = (colorKey: keyof ThemeColors, value: string) => {
    if (editedColors) {
      const updated = { ...editedColors, [colorKey]: value };
      setEditedColors(updated);
      applyThemeColors(updated);
    }
  };

  // テーマをプレビュー
  const handlePreviewTheme = () => {
    if (editedColors) {
      applyThemeColors(editedColors);
    }
  };

  // テーマを保存
  const handleSaveTheme = async () => {
    if (!newThemeName.trim() || !editedColors) return;

    const customTheme: Theme = {
      id: `custom-${Date.now()}`,
      name: newThemeName,
      colors: editedColors,
      isCustom: true,
    };

    const success = await saveCustomTheme(customTheme);
    if (success) {
      setNewThemeName('');
      setShowSaveDialog(false);
      handleThemeSelect(customTheme.id);
    }
  };

  // テーマを削除
  const handleDeleteTheme = async () => {
    if (!selectedTheme || !selectedTheme.isCustom) return;
    const success = await deleteCustomTheme(selectedTheme.id);
    if (success) {
      setDeleteConfirm(false);
      // 削除後、デフォルトテーマに切り替え
      handleThemeSelect('vs-dark');
    }
  };

  const colorFields: Array<{
    key: keyof ThemeColors;
    label: string;
  }> = [
    { key: 'editorBg', label: 'エディタ背景' },
    { key: 'editorFg', label: 'エディタテキスト' },
    { key: 'statusBg', label: 'ステータスバー背景' },
    { key: 'statusText', label: 'ステータスバーテキスト' },
    { key: 'sidebarBg', label: 'サイドバー背景' },
    { key: 'borderColor', label: '枠線色' },
    { key: 'itemHoverBg', label: 'ホバー背景' },
    { key: 'itemSelectedBg', label: '選択背景' },
    { key: 'accentColor', label: 'アクセント色' },
    { key: 'dialogueColor', label: 'セリフ色' },
  ];

  if (!isInitialized || !selectedTheme || !editedColors) {
    return <div className="theme-customizer loading">読み込み中...</div>;
  }

  const previewCode = `# 月明かりの庭園

ある静寂の夜、月は銀色の光で庭園を照らしていた。
そこには、古い思い出と新しい可能性が共存していた。

## 第一章 逢逢

「ずっと待っていたんです」と、彼女は呟いた。
窓際に立つ彼女のシルエットは、月の光に包まれていた。

## 季節の移ろい

春の桜、夏の蝉の声、秋の紅葉、冬の雪。
四季が彼女の心の中で何度も繰り返された。

---

# Moonlit Garden

The night was silent, and the moon cast its silver light across the garden.
There, old memories and new possibilities coexisted.

## Chapter One: Encounter

"I've been waiting for you all this time," she whispered.
Her silhouette by the window was wrapped in moonlight.

## The Passage of Seasons

Cherry blossoms in spring, cicada songs in summer,
crimson leaves in autumn, and snow in winter.
The seasons repeated endlessly in her heart.`;

  return (
    <div className="theme-customizer">
      <div className="theme-toolbar">
        <button className="btn" title="プレビュー更新" aria-label="プレビュー更新" onClick={handlePreviewTheme}>プレビュー更新</button>
        <button className="btn" title="新規保存" aria-label="新規保存" onClick={() => setShowSaveDialog(true)}>新規保存</button>
        <button
          className="btn"
          title="テーマを書き出す"
          aria-label="テーマを書き出す"
          onClick={async () => {
            if (!selectedTheme) return;
            try {
              const data = JSON.stringify(selectedTheme, null, 2);
              await window.electronAPI.saveFile(data, undefined, true);
            } catch (e) {
              console.error('Export theme failed', e);
            }
          }}
        >
          テーマを書き出す
        </button>
        <input
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          id="theme-import-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const text = await f.text();
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                const customs = parsed.filter((t: any) => t && t.isCustom);
                await window.electronAPI.saveThemes(customs);
              } else if (parsed && parsed.id) {
                await saveCustomTheme(parsed);
              }
              window.location.reload();
            } catch (err) {
              console.error('Import theme failed', err);
              alert('テーマの読み込みに失敗しました。正しいJSONを選んでください。');
            } finally {
              const input = document.getElementById('theme-import-input') as HTMLInputElement | null;
              if (input) input.value = '';
            }
          }}
        />
        <label htmlFor="theme-import-input" className="btn" title="テーマを読み込む" aria-label="テーマを読み込む" style={{ cursor: 'pointer' }}>
          テーマを読み込む
        </label>
        <div style={{ marginLeft: 'auto' }}>
          {selectedTheme.isCustom && (
            !deleteConfirm ? (
              <button className="btn btn-delete" title="削除" aria-label="削除" onClick={() => setDeleteConfirm(true)}>削除</button>
            ) : (
              <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>削除しますか？</span>
                <button className="btn btn-sm btn-confirm-yes" style={{ width: '6em' }} onClick={handleDeleteTheme}>はい</button>
                <button className="btn btn-sm btn-confirm-no" style={{ width: '6em' }} onClick={() => setDeleteConfirm(false)}>いいえ</button>
              </div>
            )
          )}
        </div>
      </div>
      <div className="heading-editor-container">
        <div className="heading-list-wrapper theme-left">
          <div className="customizer-section">
            <h3>テーマ選択</h3>
            <div className="theme-dropdown-wrapper">
              <select
                value={currentTheme}
                onChange={(e) => handleThemeSelect(e.target.value)}
                className="theme-dropdown"
              >
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name} {theme.isCustom ? '(カスタム)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="customizer-section">
            <h3>色設定</h3>
            <div className="color-picker-grid">
              {colorFields.map(({ key, label }) => (
                <div key={key} className="color-picker-item">
                  <label>{label}</label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      value={editedColors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="color-picker"
                    />
                    <input
                      type="text"
                      value={editedColors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="color-text"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showSaveDialog && (
            <div className="save-dialog">
              <div className="save-dialog-content">
                <h4>テーマを保存</h4>
                <input
                  type="text"
                  placeholder="テーマ名を入力"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  className="save-input"
                  autoFocus
                />
                <div className="save-dialog-actions">
                  <button
                    className="btn btn-sm btn-confirm"
                    onClick={handleSaveTheme}
                    disabled={!newThemeName.trim()}
                  >
                    保存
                  </button>
                  <button
                    className="btn btn-sm btn-cancel"
                    onClick={() => {
                      setShowSaveDialog(false);
                      setNewThemeName('');
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="heading-edit-form theme-right">
          <div className="preview-header">プレビュー</div>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Editor
              language="kotoori-text"
              value={previewCode}
              theme={selectedTheme.id === 'light' ? 'light-custom' : selectedTheme.id === 'vs-dark' ? 'vs-dark-custom' : selectedTheme.id}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'Consolas, Menlo, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                rulers: [80],
                wordWrap: 'on',
              }}
              onMount={(editor) => {
                const updateStats = () => {
                  const model = editor.getModel();
                  if (model) {
                    const totalChars = model.getValue().length;
                    const totalLines = model.getLineCount();
                    const position = editor.getPosition();
                    const line = position?.lineNumber || 1;
                    const column = position?.column || 1;
                    const lineContent = model.getLineContent(line);
                    const currentLineChars = lineContent.length;
                    const selection = editor.getSelection();
                    const selectedChars = selection ? model.getValueInRange(selection).length : 0;
                    
                    setPreviewStats({
                      line,
                      column,
                      selectedChars,
                      totalLines,
                      totalChars,
                      currentLineChars,
                    });
                  }
                };
                updateStats();
                editor.onDidChangeCursorPosition(updateStats);
                editor.onDidChangeModelContent(updateStats);
              }}
            />
            <StatusBar
              line={previewStats.line}
              column={previewStats.column}
              selectedChars={previewStats.selectedChars}
              totalLines={previewStats.totalLines}
              totalChars={previewStats.totalChars}
              currentLineChars={previewStats.currentLineChars}
              autoIndent={false}
            />
          </div>
        </div>
      </div>
      <div className="theme-footer">
        <div className="footer-text">Theme Customizer — カスタムテーマはユーザーデータとして保存されます</div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
