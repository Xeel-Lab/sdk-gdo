# Script per build degli assets frontend

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "=== Build Assets ===" -ForegroundColor Cyan
Write-Host ""

# Verifica che siamo nella root del progetto
if (-not (Test-Path "gdo_server_python/main.py")) {
    Write-Host "Errore: Esegui questo script dalla root del progetto" -ForegroundColor Red
    exit 1
}

# Verifica se la build è necessaria
$needsBuild = $false

if ($Force) {
    Write-Host "Build forzata richiesta" -ForegroundColor Yellow
    $needsBuild = $true
} elseif (-not (Test-Path "assets")) {
    Write-Host "Cartella assets/ non trovata" -ForegroundColor Yellow
    $needsBuild = $true
} elseif ((Get-ChildItem "assets" -File -Filter "*.js" -ErrorAction SilentlyContinue).Count -eq 0) {
    Write-Host "Cartella assets/ vuota" -ForegroundColor Yellow
    $needsBuild = $true
} else {
    Write-Host "Assets già presenti. Usa -Force per forzare la rebuild" -ForegroundColor Green
    exit 0
}

# Step 1: Installa dipendenze Node.js
Write-Host "Step 1: Installazione dipendenze Node.js..." -ForegroundColor Green
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore: Installazione dipendenze Node.js fallita" -ForegroundColor Red
    exit 1
}

# Step 2: Esegui la build
Write-Host "Step 2: Esecuzione build..." -ForegroundColor Green
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore: Build fallito" -ForegroundColor Red
    exit 1
}

# Step 3: Installa dipendenze Python
Write-Host "Step 3: Installazione dipendenze Python..." -ForegroundColor Green
pip install -r gdo_server_python/requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore: Installazione dipendenze Python fallita" -ForegroundColor Red
    exit 1
}

Write-Host "Build completata con successo!" -ForegroundColor Green
