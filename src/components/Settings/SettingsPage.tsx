import React from 'react';
import './Settings.css';
import { EditorSettings } from '../../hooks/useEditorSettings';
import { useThemeManagement } from '../../hooks/useThemeManagement';
import ThemeCustomizer from './ThemeCustomizer';
import BackButton from '../BackButton';

interface SettingsPageProps {
    settings: EditorSettings;
    updateSettings: (typeOrSettings: string | Partial<EditorSettings>, data?: any) => void;
    onBack: () => void;
    headingSettings: { head: string; level: number }[];
    setHeadingSettings: React.Dispatch<React.SetStateAction<{ head: string; level: number }[]>>;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, updateSettings, onBack, headingSettings, setHeadingSettings }) => {
    const [systemFonts, setSystemFonts] = React.useState<string[]>(['Meiryo', 'MS Gothic', 'Yu Gothic', 'Arial', 'Courier New']);
    const [activeTab, setActiveTab] = React.useState<'theme' | 'appearance' | 'editor' | 'save' | 'headings'>('appearance');
    const { themes } = useThemeManagement();

    // 見出し編集用のステート
    const [editingHead, setEditingHead] = React.useState('');
    const [editingLevel, setEditingLevel] = React.useState(1);
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

    React.useEffect(() => {
        const loadFonts = async () => {
            const fonts = await window.electronAPI.getSystemFonts();
            if (fonts && fonts.length > 0) setSystemFonts(fonts);
        };
        loadFonts();
    }, []);

    const fontSizes = [10, 12, 14, 16, 18, 20, 24, 30];

    // ThemeCustomizer は詳細設定のタブ内で表示する（下方の render 部分参照）

    return (
        <div className="settings-container">
            <div className="settings-sidebar">
                <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
                    <BackButton onClick={onBack} />
                </div>
                <nav className="settings-nav">
                    <button
                        className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        テーマと外観
                    </button>
                    <button
                        className={`settings-nav-item ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => setActiveTab('theme')}
                    >
                        テーマカスタマイズ
                    </button>
                    <button
                        className={`settings-nav-item ${activeTab === 'editor' ? 'active' : ''}`}
                        onClick={() => setActiveTab('editor')}
                    >
                        エディタ動作
                    </button>
                    <button
                        className={`settings-nav-item ${activeTab === 'headings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('headings')}
                    >
                        見出しの設定
                    </button>
                    <button
                        className={`settings-nav-item ${activeTab === 'save' ? 'active' : ''}`}
                        onClick={() => setActiveTab('save')}
                    >
                        保存設定
                    </button>
                </nav>
            </div>
            <div className="settings-content">
                {activeTab === 'appearance' && (
                    <section className="settings-section">
                        <h2>テーマと外観</h2>
                        <div className="setting-item">
                            <div className="setting-label">テーマ</div>
                            <div className="setting-control-with-button">
                                <select
                                    value={settings.theme}
                                    onChange={(e) => updateSettings('set-theme', e.target.value)}
                                >
                                    {themes.map(theme => (
                                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                                    ))}
                                </select>
                                <button
                                    className="btn btn-theme-editor-compact"
                                    onClick={() => setActiveTab('theme')}
                                >
                                    詳細カスタマイズ
                                </button>
                            </div>
                            <div className="setting-description">
                                テーマを選択できます。「詳細カスタマイズ」でカラーピッカーを使って細かく調整できます。
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">フォントサイズ</div>
                            <div className="setting-control">
                                <select
                                    value={settings.fontSize}
                                    onChange={(e) => updateSettings('set-font-size', e.target.value)}
                                >
                                    {fontSizes.map(s => <option key={s} value={s}>{s}px</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">フォント</div>
                            <div className="setting-control">
                                <select
                                    value={settings.fontFamily}
                                    onChange={(e) => updateSettings('set-font-family', e.target.value)}
                                >
                                    {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="setting-description">エディタで使用するフォントを選択してください。</div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">行間</div>
                            <div className="setting-control">
                                <select
                                    value={settings.lineHeight}
                                    onChange={(e) => updateSettings('set-line-height', e.target.value)}
                                >
                                    <option value={1.2}>狭い (1.2)</option>
                                    <option value={1.5}>標準 (1.5)</option>
                                    <option value={1.8}>やや広い (1.8)</option>
                                    <option value={2.0}>広い (2.0)</option>
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="render-whitespace"
                                    checked={settings.renderWhitespace}
                                    onChange={(e) => updateSettings('set-render-whitespace', e.target.checked)}
                                />
                                <label htmlFor="render-whitespace">スペースとタブを視覚的に表示する</label>
                            </div>
                        </div>

                        <hr className="settings-divider" />
                        <h3>ステータス表示</h3>
                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="genkoyoushi-mode"
                                    checked={settings.showGenkoyoushiMode}
                                    onChange={(e) => updateSettings('set-genkoyoushi-mode', e.target.checked)}
                                />
                                <label htmlFor="genkoyoushi-mode">４００字詰め原稿用紙換算表示</label>
                            </div>
                            <div className="setting-description">
                                有効にするとステータスバーに現在のテキスト量を400字詰め原稿用紙の枚数で表示します。
                            </div>
                        </div>

                        <hr className="settings-divider" />
                        <h3>縦書きプレビューの設定</h3>
                        <div className="setting-item">
                            <div className="setting-label">一行の文字数</div>
                            <div className="setting-control">
                                <input
                                    type="number"
                                    value={settings.verticalCharsPerLine}
                                    onChange={(e) => updateSettings('set-vertical-chars', e.target.value)}
                                    min="10"
                                    max="100"
                                />
                            </div>
                            <div className="setting-description">
                                縦書きプレビュー時の一行の文字数（高さ）を指定します。
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">縦書き用フォント</div>
                            <div className="setting-control">
                                <select
                                    value={settings.verticalFontFamily}
                                    onChange={(e) => updateSettings('set-vertical-font', e.target.value)}
                                >
                                    {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">縦書き用サイズ</div>
                            <div className="setting-control">
                                <select
                                    value={settings.verticalFontSize}
                                    onChange={(e) => updateSettings('set-vertical-font-size', e.target.value)}
                                >
                                    {fontSizes.map(s => <option key={s} value={s}>{s}px</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="vertical-kinsoku"
                                    checked={settings.verticalKinsoku}
                                    onChange={(e) => updateSettings('set-vertical-kinsoku', e.target.checked)}
                                />
                                <label htmlFor="vertical-kinsoku">禁則処理を行う</label>
                            </div>
                            <div className="setting-description">
                                行頭・行末に句読点などが来ないように調整します。
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'theme' && (
                    <section className="settings-section">
                        <h2>テーマカスタマイズ</h2>
                        <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
                            <ThemeCustomizer
                                currentTheme={settings.theme}
                                onThemeChange={(themeId) => updateSettings('set-theme', themeId)}
                            />
                        </div>
                    </section>
                )}

                {activeTab === 'editor' && (
                    <section className="settings-section">
                        <h2>エディタ動作</h2>
                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="line-numbers"
                                    checked={settings.lineNumbers === 'on'}
                                    onChange={(e) => updateSettings('set-line-numbers', e.target.checked)}
                                />
                                <label htmlFor="line-numbers">行番号を表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="show-minimap"
                                    checked={settings.showMinimap}
                                    onChange={(e) => updateSettings('set-minimap', e.target.checked)}
                                />
                                <label htmlFor="show-minimap">ミニマップを表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="auto-indent"
                                    checked={settings.autoIndent}
                                    onChange={(e) => updateSettings('set-auto-indent', e.target.checked)}
                                />
                                <label htmlFor="auto-indent">オートインデントを有効にする</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="typewriter-mode"
                                    checked={settings.typewriterMode}
                                    onChange={(e) => updateSettings('set-typewriter-mode', e.target.checked)}
                                />
                                <label htmlFor="typewriter-mode">タイプライタースクロール（常に中央にカーソルを維持）</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="highlight-dialogue"
                                    checked={settings.highlightDialogue}
                                    onChange={(e) => updateSettings('set-highlight-dialogue', e.target.checked)}
                                />
                                <label htmlFor="highlight-dialogue">会話文・引用句をハイライト表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="show-ruby-toolbar"
                                    checked={settings.showRubyToolbar}
                                    onChange={(e) => updateSettings('set-show-ruby-toolbar', e.target.checked)}
                                />
                                <label htmlFor="show-ruby-toolbar">ルビ・傍点ツールボタンをツールバーに表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="show-markdown-toolbar"
                                    checked={settings.showMarkdownToolbar}
                                    onChange={(e) => updateSettings('set-show-markdown-toolbar', e.target.checked)}
                                />
                                <label htmlFor="show-markdown-toolbar">Markdownツールボタンをツールバーに表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="show-outline"
                                    checked={settings.showOutline}
                                    onChange={(e) => updateSettings('set-show-outline', e.target.checked)}
                                />
                                <label htmlFor="show-outline">アウトライン（見出し）を表示する</label>
                            </div>
                            <div className="setting-description" style={{ marginTop: '8px', lineHeight: '1.6' }}>
                                # を行頭につけることで見出しを作成できます。<br />
                                # の数で見出しの階層を指定します（最大6まで）。<br />
                                見出しの後には半角スペースを入れると読みやすくなります。
                            </div>
                        </div>

                        <hr className="settings-divider" />
                        <h3>折り返しとルーラー</h3>
                        <div className="setting-item">
                            <div className="setting-label">折り返し設定</div>
                            <div className="setting-control">
                                <select
                                    value={settings.wordWrap}
                                    onChange={(e) => updateSettings('set-word-wrap', e.target.value)}
                                >
                                    <option value="off">折り返ししない</option>
                                    <option value="on">右端で折り返す</option>
                                    <option value="wordWrapColumn">ルーラーで折り返す</option>
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="show-ruler"
                                    checked={settings.showRuler}
                                    onChange={(e) => updateSettings('set-ruler', e.target.checked)}
                                />
                                <label htmlFor="show-ruler">ルーラーを表示する</label>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">ルーラー位置 (文字数)</div>
                            <div className="setting-control">
                                <input
                                    type="number"
                                    value={settings.rulerPosition}
                                    onChange={(e) => updateSettings('set-ruler-position', e.target.value)}
                                    min="1"
                                    max="200"
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">ルーラー位置の微調整 (px)</div>
                            <div className="setting-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="range"
                                    value={settings.rulerOffset}
                                    onChange={(e) => updateSettings('set-ruler-offset', e.target.value)}
                                    min="-50"
                                    max="50"
                                    step="1"
                                    style={{ flexGrow: 1 }}
                                />
                                <span style={{ minWidth: '40px', textAlign: 'right' }}>{settings.rulerOffset}px</span>
                                <button
                                    className="secondary-button"
                                    style={{ padding: '2px 8px', fontSize: '11px' }}
                                    onClick={() => updateSettings('set-ruler-offset', 0)}
                                >リセット</button>
                            </div>
                            <div className="setting-description">フォントによってルーラーがずれる場合に調整してください。</div>
                        </div>
                    </section>
                )}

                {activeTab === 'save' && (
                    <section className="settings-section">
                        <h2>保存設定</h2>
                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="enable-auto-save"
                                    checked={settings.enableAutoSave}
                                    onChange={(e) => updateSettings('set-auto-save', e.target.checked)}
                                />
                                <label htmlFor="enable-auto-save">自動保存を有効にする</label>
                            </div>
                            <div className="setting-description">
                                有効にすると、ファイルの一行目が確定したときや、ファイルの内容を変更したときに自動保存されます。
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-control">
                                <input
                                    type="checkbox"
                                    id="restore-last-file"
                                    checked={settings.restoreLastFile}
                                    onChange={(e) => updateSettings('set-restore-last-file', e.target.checked)}
                                />
                                <label htmlFor="restore-last-file">起動時に前回編集していたファイルを読み込む</label>
                            </div>
                            <div className="setting-description">
                                有効にすると、アプリケーション起動時に前回編集していたファイルが自動的に読み込まれます。
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-label">デフォルトの保存場所</div>
                            <div className="setting-control" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="path-display" style={{
                                    padding: '8px 12px',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    borderRadius: '4px',
                                    fontSize: '0.9em',
                                    wordBreak: 'break-all',
                                    color: 'var(--text-color)'
                                }}>
                                    {settings.defaultStoragePath || '読み込み中...'}
                                </div>
                                <button
                                    className="secondary-button"
                                    style={{ alignSelf: 'flex-start' }}
                                    onClick={async () => {
                                        const path = await window.electronAPI.selectFolder();
                                        if (path) {
                                            updateSettings('set-default-storage-path', path);
                                        }
                                    }}
                                >
                                    場所を変更する
                                </button>
                            </div>
                            <div className="setting-description">
                                新しいテキストを保存する際のデフォルトの場所です。
                            </div>
                        </div>
                    </section>
                )}

                {activeTab === 'headings' && (
                    <section className="settings-section">
                        <h2>見出しの設定</h2>
                        <div className="setting-description">
                            アウトラインビューで抽出される見出しのパターン（正規表現）をカスタマイズできます。
                        </div>

                        <div style={{ marginTop: '8px', marginBottom: '12px', display: 'flex', gap: '8px' }}>
                            <button
                                className="btn"
                                onClick={async () => {
                                    try {
                                        const data = JSON.stringify(headingSettings, null, 2);
                                        await window.electronAPI.saveFile(data, undefined, true);
                                    } catch (e) {
                                        console.error('Export headings failed', e);
                                    }
                                }}
                            >
                                見出しを書き出す
                            </button>
                            <input
                                id="headings-import-input"
                                type="file"
                                accept="application/json,.json"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const f = (e.target as HTMLInputElement).files?.[0];
                                    if (!f) return;
                                    try {
                                        const text = await f.text();
                                        const parsed = JSON.parse(text);
                                        if (Array.isArray(parsed) && parsed.every((p: any) => p && typeof p.head === 'string' && typeof p.level === 'number')) {
                                            setHeadingSettings(parsed);
                                            await window.electronAPI.saveHeadings(parsed);
                                        } else {
                                            alert('不正な見出しデータです。正しいJSONを選択してください。');
                                        }
                                    } catch (err) {
                                        console.error('Import headings failed', err);
                                        alert('見出しの読み込みに失敗しました。');
                                    } finally {
                                        const input = document.getElementById('headings-import-input') as HTMLInputElement | null;
                                        if (input) input.value = '';
                                    }
                                }}
                            />
                            <label htmlFor="headings-import-input" className="btn" style={{ cursor: 'pointer' }}>
                                見出しを読み込む
                            </label>
                        </div>

                        <div className="heading-editor-container">
                            <div className="heading-list-wrapper">
                                <table className="heading-table">
                                    <thead>
                                        <tr>
                                            <th>見出し（正規表現）</th>
                                            <th style={{ width: '80px' }}>レベル</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {headingSettings.map((h, index) => (
                                            <tr
                                                key={index}
                                                className={selectedIndex === index ? 'selected' : ''}
                                                onClick={() => {
                                                    setSelectedIndex(index);
                                                    setEditingHead(h.head);
                                                    setEditingLevel(h.level);
                                                }}
                                            >
                                                <td>{h.head}</td>
                                                <td>{h.level}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="heading-edit-form">
                                <div className="form-group">
                                    <label>見出しパターン（正規表現）</label>
                                    <input
                                        type="text"
                                        value={editingHead}
                                        onChange={(e) => setEditingHead(e.target.value)}
                                        placeholder="例: ^第.+章"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>見出しレベル (1～6)</label>
                                    <select
                                        value={editingLevel}
                                        onChange={(e) => setEditingLevel(Number(e.target.value))}
                                    >
                                        {[1, 2, 3, 4, 5, 6].map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={async () => {
                                            if (!editingHead.trim()) return;
                                            const newHeadings = [...headingSettings];
                                            const existingIndex = newHeadings.findIndex(h => h.head === editingHead);

                                            if (existingIndex !== -1) {
                                                newHeadings[existingIndex] = { head: editingHead, level: editingLevel };
                                            } else {
                                                newHeadings.push({ head: editingHead, level: editingLevel });
                                            }

                                            setHeadingSettings(newHeadings);
                                            await window.electronAPI.saveHeadings(newHeadings);
                                            setSelectedIndex(null);
                                            setEditingHead('');
                                            setEditingLevel(1);
                                        }}
                                    >
                                        {headingSettings.some(h => h.head === editingHead) ? '更新' : '追加'}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setSelectedIndex(null);
                                            setEditingHead('');
                                            setEditingLevel(1);
                                        }}
                                    >
                                        新規
                                    </button>
                                    {selectedIndex !== null && (
                                        <button
                                            className="btn btn-danger"
                                            onClick={async () => {
                                                const newHeadings = headingSettings.filter((_, i) => i !== selectedIndex);
                                                setHeadingSettings(newHeadings);
                                                await window.electronAPI.saveHeadings(newHeadings);
                                                setSelectedIndex(null);
                                                setEditingHead('');
                                                setEditingLevel(1);
                                            }}
                                            style={{ marginLeft: 'auto' }}
                                        >
                                            削除
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                <footer className="settings-footer">
                    <div className="settings-footer-item">
                        <span className="dev-label">DEV</span>
                        ことおり Kotoori Editor v1.0.0
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SettingsPage;
