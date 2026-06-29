# Deploy Pulse to Google Cloud Run
# Prerequisites: gcloud CLI — https://cloud.google.com/sdk/docs/install
#
# Usage:
#   .\scripts\deploy-cloudrun.ps1
#   .\scripts\deploy-cloudrun.ps1 -ProjectId my-gcp-project -Region us-central1
#   .\scripts\deploy-cloudrun.ps1 -UpdateSupabaseAuth   # also patch Supabase redirect URLs

param(
  [string]$ProjectId = "",
  [string]$Region = "us-central1",
  [string]$ServiceName = "pulse",
  [switch]$UpdateSupabaseAuth
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Read-DotEnv([string]$key) {
  $line = Get-Content ".env" -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^$key=", "").Trim().Trim('"').Trim("'")
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Host "Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
  Write-Host "Then run: gcloud auth login && gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
  exit 1
}

if (-not $ProjectId) {
  $ProjectId = (gcloud config get-value project 2>$null)
}
if (-not $ProjectId) {
  Write-Host "Set a GCP project: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
  exit 1
}

$supabaseUrl = Read-DotEnv "SUPABASE_URL"
$supabaseKey = Read-DotEnv "SUPABASE_PUBLISHABLE_KEY"
$serviceRoleKey = Read-DotEnv "SUPABASE_SERVICE_ROLE_KEY"
$viteUrl = Read-DotEnv "VITE_SUPABASE_URL"
if (-not $viteUrl) { $viteUrl = $supabaseUrl }
$viteKey = Read-DotEnv "VITE_SUPABASE_PUBLISHABLE_KEY"
if (-not $viteKey) { $viteKey = $supabaseKey }
$viteProjectId = Read-DotEnv "VITE_SUPABASE_PROJECT_ID"
if (-not $viteProjectId) { $viteProjectId = Read-DotEnv "SUPABASE_PROJECT_ID" }
$aiProvider = Read-DotEnv "AI_PROVIDER"
if (-not $aiProvider) { $aiProvider = "google" }
$aiModel = Read-DotEnv "AI_MODEL"
if (-not $aiModel) { $aiModel = "gemini-2.5-flash" }
$geminiKey = Read-DotEnv "GOOGLE_GENERATIVE_AI_API_KEY"

if (-not $supabaseUrl -or -not $supabaseKey) {
  Write-Host "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env" -ForegroundColor Red
  exit 1
}
if (-not $viteUrl -or -not $viteKey) {
  Write-Host "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env" -ForegroundColor Red
  exit 1
}
if (-not $geminiKey) {
  Write-Host "Warning: GOOGLE_GENERATIVE_AI_API_KEY not set — AI Coach will not work." -ForegroundColor Yellow
}

$envFile = Join-Path $env:TEMP "pulse-cloudrun-env.yaml"
@"
SUPABASE_URL: "$supabaseUrl"
SUPABASE_PUBLISHABLE_KEY: "$supabaseKey"
AI_PROVIDER: "$aiProvider"
AI_MODEL: "$aiModel"
"@ | Set-Content -Path $envFile -Encoding utf8

if ($serviceRoleKey) {
  Add-Content -Path $envFile -Value "SUPABASE_SERVICE_ROLE_KEY: `"$serviceRoleKey`""
}
if ($geminiKey) {
  Add-Content -Path $envFile -Value "GOOGLE_GENERATIVE_AI_API_KEY: `"$geminiKey`""
}

$buildEnvVars = @(
  "VITE_SUPABASE_URL=$viteUrl",
  "VITE_SUPABASE_PUBLISHABLE_KEY=$viteKey"
)
if ($viteProjectId) {
  $buildEnvVars += "VITE_SUPABASE_PROJECT_ID=$viteProjectId"
}

Write-Host "Deploying $ServiceName to Cloud Run (project: $ProjectId, region: $Region)..." -ForegroundColor Cyan
Write-Host "This builds the Docker image in Cloud Build (first deploy may take several minutes)." -ForegroundColor Gray

gcloud run deploy $ServiceName `
  --source . `
  --project $ProjectId `
  --region $Region `
  --allow-unauthenticated `
  --env-vars-file $envFile `
  --set-build-env-vars ($buildEnvVars -join ",") `
  --port 8080

$url = (gcloud run services describe $ServiceName --project $ProjectId --region $Region --format "value(status.url)").TrimEnd("/")

Write-Host ""
Write-Host "Deployed: $url" -ForegroundColor Green
Write-Host ""
Write-Host "Update Supabase auth URLs (required for sign-in on Cloud Run):" -ForegroundColor Yellow
Write-Host "  Site URL: $url"
Write-Host "  Redirects: $url/** , $url/auth/callback"
Write-Host ""

if ($UpdateSupabaseAuth) {
  if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "Skipping Supabase auth update — set SUPABASE_ACCESS_TOKEN to run -UpdateSupabaseAuth" -ForegroundColor Yellow
  } else {
    Write-Host "Updating Supabase auth redirect URLs..." -ForegroundColor Cyan
    $env:APP_ORIGIN = $url
    node scripts/configure-supabase-auth.mjs --autoconfirm
  }
} else {
  Write-Host "Tip: re-run with -UpdateSupabaseAuth after setting SUPABASE_ACCESS_TOKEN to patch Supabase automatically." -ForegroundColor Gray
}

Remove-Item -Path $envFile -Force -ErrorAction SilentlyContinue
