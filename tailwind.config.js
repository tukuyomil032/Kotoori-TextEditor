/** @type {import('tailwindcss').Config} */
export default {
  // App コンポーネント (MenuBar, ToolBar, BackButton, StatusBar, Settings, History) のみに限定
  content: [
    './src/components/MenuBar.tsx',
    './src/components/ToolBar.tsx',
    './src/components/BackButton.tsx',
    './src/components/StatusBar.tsx',
    './src/components/History/**/*.{tsx,ts}',
    './src/components/Settings/**/*.{tsx,ts}',
  ],
  // Monaco / MarkdownPreview は既存 CSS のスコープを維持するため除外
  corePlugins: {
    preflight: false, // グローバルリセットを無効化（Monaco スタイルと干渉しないよう）
  },
  theme: {
    extend: {
      colors: {
        // CSS Custom Properties と連動するセマンティックカラー
        'editor-bg': 'var(--editor-bg, #1e1e1e)',
        'editor-fg': 'var(--editor-fg, #d4d4d4)',
        'sidebar-bg': 'var(--sidebar-bg, #252526)',
        'border-color': 'var(--border-color, #333333)',
        'item-hover': 'var(--item-hover-bg, #2a2a2d)',
        'item-selected': 'var(--item-selected-bg, #37373d)',
        'accent': 'var(--accent-color, #007acc)',
        'status-bg': 'var(--status-bg, #333333)',
        'status-text': 'var(--status-text, #cccccc)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Meiryo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
