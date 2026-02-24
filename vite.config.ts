import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/icon',
          dest: 'assets/icon'
        }
      ]
    })
  ],

  // Vite のポートを tauri.conf.json の devUrl に合わせる
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // src-tauri はウォッチ対象外（Tauri CLIが管理）
      ignored: ['**/src-tauri/**']
    }
  },

  build: {
    // Tauri が要求する ES2021 以上
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // デバッグビルド時はソースマップ有効
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
    assetsDir: 'assets'
  },

  clearScreen: false,

  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.worker']
  }
}))
