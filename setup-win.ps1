# Windows: zip from the internet has Mark of the Web; WDAC/Smart App Control
# then blocks Rollup native *.node. Strip MOTW, fresh install, start Vite.
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
if (Test-Path node_modules\.vite) {
  Remove-Item -Recurse -Force node_modules\.vite
}

Write-Host 'npm install (Rollup via WASM — no native .node)...'
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Starting Vite...'
npm run dev
