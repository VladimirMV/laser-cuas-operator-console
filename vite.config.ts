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
})
