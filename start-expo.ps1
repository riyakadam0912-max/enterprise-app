#!/usr/bin/env pwsh

# Expo Dev Server Startup Script
# This script properly starts the Expo dev server and validates network connectivity

param(
    [ValidateSet('android', 'ios', 'web', 'all')]
    [string]$Platform = 'all',
    [switch]$ClearCache,
    [switch]$ShowIp
)

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          Expo Development Server Launcher                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Change to app directory
$AppPath = Join-Path $PSScriptRoot "app"
if (-not (Test-Path $AppPath)) {
    Write-Host "❌ Error: app directory not found at $AppPath" -ForegroundColor Red
    exit 1
}

Set-Location $AppPath
Write-Host "✓ Working directory: $(Get-Location)" -ForegroundColor Green

# Show IP address
if ($ShowIp) {
    Write-Host ""
    Write-Host "📍 Network Configuration:" -ForegroundColor Yellow
    $IpConfig = ipconfig | Select-String -Pattern "IPv4 Address", "Subnet Mask" -Context 0
    Write-Host $IpConfig
    Write-Host ""
}

# Check dependencies
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing node_modules..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ Dependencies ready" -ForegroundColor Green

# Clear cache if requested
if ($ClearCache) {
    Write-Host ""
    Write-Host "🧹 Clearing Expo cache..." -ForegroundColor Yellow
    expo start --clear
    exit
}

# Check if port 19000 is available
Write-Host ""
Write-Host "🔍 Checking port 19000 availability..." -ForegroundColor Yellow
$PortInUse = netstat -ano | Select-String ":19000" | Select-String "LISTENING"
if ($PortInUse) {
    Write-Host "⚠️  Port 19000 is already in use" -ForegroundColor Yellow
    Write-Host $PortInUse
    Write-Host "This could be a previous Expo instance or another service" -ForegroundColor Yellow
    Write-Host ""
    $Kill = Read-Host "Kill the existing process? (y/n)"
    if ($Kill -eq 'y') {
        $Pid = $PortInUse | Select-String -Pattern "\s+(\d+)\s*$" | ForEach-Object { $_.Matches[0].Groups[1].Value }
        Write-Host "Killing process $Pid..." -ForegroundColor Yellow
        Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "✓ Process killed" -ForegroundColor Green
    }
}

# Start Expo server
Write-Host ""
Write-Host "🚀 Starting Expo development server..." -ForegroundColor Cyan
Write-Host "Press 'a' for Android, 'i' for iOS, 'w' for web, or 'q' to quit" -ForegroundColor Gray
Write-Host ""

$ExpoArgs = @("start")

switch ($Platform) {
    'android' { $ExpoArgs += "--android" }
    'ios' { $ExpoArgs += "--ios" }
    'web' { $ExpoArgs += "--web" }
}

# Start the dev server
& expo @ExpoArgs

# Cleanup message
Write-Host ""
Write-Host "👋 Expo development server stopped" -ForegroundColor Yellow
