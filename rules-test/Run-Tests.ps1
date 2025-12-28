# Run Firestore Rules Tests in PowerShell
Write-Host "Running Firestore Security Rules Tests..." -ForegroundColor Cyan
Write-Host "---------------------------------------" -ForegroundColor Cyan

# Get the script directory path
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $scriptPath

Write-Host "Current directory: $scriptPath" -ForegroundColor Gray

Write-Host "Copying firestore.rules from parent directory..." -ForegroundColor Gray
Copy-Item -Path ..\firestore.rules -Destination firestore.rules -Force

Write-Host "Installing dependencies if needed..." -ForegroundColor Gray
npm install | Out-Null

Write-Host "Running tests..." -ForegroundColor Green
npx jest

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
} else {
    Write-Host "All tests completed successfully!" -ForegroundColor Green
}