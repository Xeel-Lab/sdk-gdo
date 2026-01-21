# Script per avviare il server Python

param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Write-Host "=== Avvio Server Python ===" -ForegroundColor Cyan
Write-Host ""

# Verifica che siamo nella root del progetto
if (-not (Test-Path "gdo_server_python/main.py")) {
    Write-Host "Errore: Esegui questo script dalla root del progetto" -ForegroundColor Red
    exit 1
}

# Verifica che il file .env esista
if (-not (Test-Path ".env")) {
    Write-Host "Errore: File .env non trovato nella root del progetto" -ForegroundColor Red
    Write-Host "Crea un file .env con le variabili necessarie (vedi documentazione)" -ForegroundColor Red
    exit 1
}

# Verifica che Python sia disponibile
$pythonPath = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonPath) {
    Write-Host "Errore: Python non trovato. Assicurati che Python sia installato e nel PATH" -ForegroundColor Red
    exit 1
}

# Carica variabili d'ambiente da .env
$envVars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Usa PORT da variabile d'ambiente (come Render) o dal parametro o da .env
if ($env:PORT) {
    $Port = [int]$env:PORT
} elseif ($envVars.ContainsKey("PORT")) {
    $Port = [int]$envVars["PORT"]
}

# Verifica che il virtual environment esista (opzionale ma consigliato)
$venvPath = ".venv"
if (Test-Path $venvPath) {
    Write-Host "Attivazione virtual environment..." -ForegroundColor Green
    & "$venvPath\Scripts\Activate.ps1"
} else {
    Write-Host "Avviso: Virtual environment non trovato. Assicurati di aver installato le dipendenze." -ForegroundColor Yellow
}

Write-Host "Avvio server Python su 0.0.0.0:$Port..." -ForegroundColor Green

# Avvia il server Python (come Render: --host 0.0.0.0 --port $PORT)
# Usa --log-level info per mostrare tutti i log (inclusi quelli del logger Python)
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn gdo_server_python.main:app --host 0.0.0.0 --port $Port --reload --log-level info
