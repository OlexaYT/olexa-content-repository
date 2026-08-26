param(
  [switch]$SyncOnly,
  [switch]$DevOnly
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "OLEXA ARCHIVE" -ForegroundColor Cyan
Write-Host "-------------"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or is not on PATH. Install Node 18+ first."
}

Write-Host ("Node: " + (node --version))

if (-not $DevOnly) {
  if (-not $env:YOUTUBE_API_KEY) {
    $persistent = [Environment]::GetEnvironmentVariable("YOUTUBE_API_KEY", "User")
    if ($persistent) {
      $env:YOUTUBE_API_KEY = $persistent
      Write-Host "Loaded YOUTUBE_API_KEY from your Windows user environment." -ForegroundColor Green
    } else {
      throw "YOUTUBE_API_KEY was not found in this PowerShell session or your Windows user environment."
    }
  } else {
    Write-Host "YOUTUBE_API_KEY is available in this PowerShell session." -ForegroundColor Green
  }

  Write-Host "Syncing YouTube archive..." -ForegroundColor Cyan
  npm run sync
}

if (-not $SyncOnly) {
  Write-Host ""
  Write-Host "Starting local site at http://localhost:4173" -ForegroundColor Green
  npm run dev
}
