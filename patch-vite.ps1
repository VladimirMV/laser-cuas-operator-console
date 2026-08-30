# Overwrite vite.config.ts so esbuild-wasm skips destructuring transforms.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false
$content = @'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  server: { host: '0.0.0.0', port: 5173 },
  esbuild: esbuildCompat,
  optimizeDeps: { esbuildOptions: esbuildCompat },
  build: { target: 'esnext' },
})
'@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'vite.config.ts'), $content, $utf8)
if (Test-Path 'node_modules\.vite') { Remove-Item -Recurse -Force 'node_modules\.vite' }
Write-Host 'vite.config.ts patched. Starting Vite...'
npm run dev
