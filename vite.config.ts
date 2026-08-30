import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// esbuild-wasm (WDAC on Windows) cannot downlevel destructuring/object-rest.
// Claim the features as supported so the transform is skipped; consoles are current Chromium.
const esbuildCompat = {
  target: 'esnext' as const,
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
    esbuildOptions: esbuildCompat,
  },
  build: {
    target: 'esnext',
  },
})
