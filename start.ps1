# Launches the BigQuery Explorer backend and frontend together.
# Run from the project root: .\start.ps1

$root = $PSScriptRoot
$venvPython = Join-Path $root "backend\venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Backend virtual environment not found. Setting it up..." -ForegroundColor Yellow
    python -m venv (Join-Path $root "backend\venv")
    & $venvPython -m pip install --upgrade pip -q
    & $venvPython -m pip install -r (Join-Path $root "backend\requirements.txt") -q
}

if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Frontend dependencies not found. Running npm install..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    npm install
    Pop-Location
}

Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "`nBigQuery Explorer is starting in two new windows. Open http://localhost:5173 once both are ready." -ForegroundColor Green
