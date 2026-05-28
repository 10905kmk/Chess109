import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

function copyStockfish() {
  return {
    name: 'copy-stockfish',
    buildStart() {
      try {
        const src = resolve('node_modules/stockfish/src')
        const dest = resolve('public/stockfish')
        mkdirSync(dest, { recursive: true })
        copyFileSync(`${src}/stockfish-nnue-16.js`, `${dest}/stockfish-nnue-16.js`)
        copyFileSync(`${src}/stockfish-nnue-16.wasm`, `${dest}/stockfish-nnue-16.wasm`)
      } catch (e) {
        console.warn('Stockfish copy skipped:', e.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyStockfish()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
      '/auth': {
        target: 'http://localhost:3001',
      },
      '/health': {
        target: 'http://localhost:3001',
      },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['stockfish'],
  },
})
