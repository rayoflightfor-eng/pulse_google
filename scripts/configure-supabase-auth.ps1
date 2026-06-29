# Fix Supabase Auth redirect URLs and optionally skip confirmation emails locally.
#
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   .\scripts\configure-supabase-auth.ps1
#   .\scripts\configure-supabase-auth.ps1 -AutoConfirm

param(
  [string]$AppOrigin = "http://localhost:8080",
  [switch]$AutoConfirm
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
   .\scripts\configure-supabase-auth.ps1$(if ($AutoConfirm) { " -AutoConfirm" })

"@ -ForegroundColor Yellow
  exit 1
}

$env:APP_ORIGIN = $AppOrigin
$args = @("scripts/configure-supabase-auth.mjs")
if ($AutoConfirm) { $args += "--autoconfirm" }
node @args
