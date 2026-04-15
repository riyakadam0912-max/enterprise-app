param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'SilentlyContinue'

$owningProcesses = Get-NetTCPConnection -LocalPort $Port -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $owningProcesses) {
  Write-Output "Port $Port is already free."
  exit 0
}

foreach ($pid in $owningProcesses) {
  try {
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Output "Stopped process $pid on port $Port."
  } catch {
    Write-Output "Could not stop process $pid on port ${Port}: $($_.Exception.Message)"
  }
}
