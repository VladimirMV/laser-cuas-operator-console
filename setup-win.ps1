# Windows: zip from the internet has Mark of the Web; WDAC/Smart App Control
# then blocks Rollup/esbuild native *.node / *.exe. Strip MOTW, fresh install, WASM rollup.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host 'Unblocking files (Mark of the Web)...'
Get-ChildItem -Recurse -Force -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

if (Test-Path node_modules) {
  Write-Host 'Removing node_modules...'
  Remove-Item -Recurse -Force node_modules
}
if (Test-Path package-lock.json) {
  Write-Host 'Removing package-lock.json (was built on Linux)...'
  Remove-Item -Force package-lock.json
}

Write-Host 'npm install (Rollup/esbuild via WASM — no native .node)...'
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Starting Vite...'
npm run dev
