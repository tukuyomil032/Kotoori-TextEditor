import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'   // ← 追加

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
        onstart(args) {
          const extraArgs = process.argv.slice(3)
          process.env.VITE_DEV_ELECTRON_ARGS = JSON.stringify(extraArgs)
          args.startup()
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),

    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/icon',
          dest: 'assets/icon'
        }
      ]
    })
  ],

  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },

  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.worker']
  },
})
