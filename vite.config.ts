import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // relative base → works on GitHub Pages any path and local preview
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  // esbuild-wasm (Windows WDAC) cannot downlevel destructuring to chrome87.
  // Operator consoles are current Chromium/Edge — es2022 needs no such transform.
  esbuild: { target: 'es2022' },
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
  },
  build: {
    target: 'es2022',
  },
})
