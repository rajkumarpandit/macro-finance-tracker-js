# Deploy Firebase Security Rules
Write-Host "Deploying Firebase Security Rules..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

# Get the script directory path
$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Checking for firestore.rules file..." -ForegroundColor Gray
$rulesPath = Join-Path -Path $rootPath -ChildPath "firestore.rules"

if (-not (Test-Path -Path $rulesPath)) {
    Write-Host "Error: firestore.rules file not found at $rulesPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found rules file: $rulesPath" -ForegroundColor Green
Write-Host "Deploying rules to Firebase..." -ForegroundColor Yellow

# Deploy rules
firebase deploy --only firestore:rules

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Make sure you're logged in to Firebase CLI with 'firebase login'" -ForegroundColor Yellow
    exit $LASTEXITCODE
} else {
    Write-Host "Rules deployed successfully!" -ForegroundColor Green
    Write-Host "Your Firebase security rules have been updated." -ForegroundColor Green
}