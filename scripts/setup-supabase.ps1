# Create a new Supabase project and update .env
# Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens

param(
  [string]$AppOrigin = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host @"

Missing SUPABASE_ACCESS_TOKEN.

1. Open https://supabase.com/dashboard/account/tokens
2. Create a token
3. Run:

   `$env:SUPABASE_ACCESS_TOKEN = "YOUR_TOKEN"
   .\scripts\setup-supabase.ps1

"@ -ForegroundColor Yellow
  exit 1
}

$env:APP_ORIGIN = $AppOrigin
node scripts/setup-supabase.mjs
