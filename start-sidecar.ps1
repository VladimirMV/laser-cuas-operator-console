# Start media sidecar (real mp4 on disk). Run in a second terminal.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'sidecar')
Get-ChildItem -Recurse -Force -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
if (-not (Test-Path 'node_modules')) { npm install }
Write-Host "mediaRoot will be $(Join-Path (Get-Location) 'media')"
npm start
