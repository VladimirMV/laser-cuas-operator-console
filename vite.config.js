import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Loaded as plain JS (before vite.config.ts). esbuild-wasm cannot downlevel
// destructuring to chrome87 — skip prebundle and keep modern syntax.
console.log('[HMI 1.8.0] vite.config.js loaded — esnext, noDiscovery')

const esbuildCompat = {
  target: 'esnext',
  supported: {
    destructuring: true,
    'object-rest-spread': true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  esbuild: esbuildCompat,
  optimizeDeps: {
    noDiscovery: true,
    include: [],
    esbuildOptions: esbuildCompat,
  },
  build: {
    target: 'esnext',
  },
})
