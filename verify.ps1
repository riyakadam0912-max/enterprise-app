$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Write-Fail {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Red
}

$repoRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  $repoRoot = Get-Location
}

Set-Location $repoRoot

if (-not (Test-Path '.git')) {
  Write-Fail 'Not a Git repository.'
  exit 1
}

$null = & git rev-parse --verify HEAD 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Warn 'No commits yet. Nothing has been pushed to GitHub from this branch.'
  exit 0
}

$null = & git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Warn 'No remote origin configured.'
  exit 0
}

Write-Info 'Fetching remote state...'
& git fetch origin --prune
if ($LASTEXITCODE -ne 0) {
  Write-Fail 'Unable to fetch origin.'
  exit 1
}

$branch = & git branch --show-current
if ($LASTEXITCODE -ne 0) {
  Write-Fail 'Unable to determine current branch.'
  exit 1
}

if ([string]::IsNullOrWhiteSpace($branch)) {
  Write-Warn 'Detached HEAD detected. Verification is limited to the current commit.'
  & git log -1 --oneline --decorate
  exit 0
}

$upstream = & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
if ([string]::IsNullOrWhiteSpace($upstream)) {
  Write-Warn 'No upstream branch found. This branch may never have been pushed.'
  exit 0
}

$counts = & git rev-list --left-right --count "$branch...$upstream"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($counts)) {
  Write-Fail 'Unable to compare local and remote branches.'
  exit 1
}

$parts = $counts -split '\s+'
$ahead = [int]$parts[0]
$behind = [int]$parts[1]

Write-Info "Branch: $branch"
Write-Info "Upstream: $upstream"
Write-Info "Ahead: $ahead"
Write-Info "Behind: $behind"

Write-Host ''
Write-Info 'Unpushed commits:'
if ($ahead -gt 0) {
  & git log --oneline "$upstream..$branch"
} else {
  Write-Ok 'None'
}

Write-Host ''
Write-Info 'Remote commits not in local:'
if ($behind -gt 0) {
  & git log --oneline "$branch..$upstream"
} else {
  Write-Ok 'None'
}

Write-Host ''
if ($ahead -eq 0 -and $behind -eq 0) {
  Write-Ok 'Your branch is fully synced with GitHub.'
} elseif ($ahead -gt 0 -and $behind -eq 0) {
  Write-Warn 'Your branch still has unpushed commits.'
} elseif ($ahead -eq 0 -and $behind -gt 0) {
  Write-Warn 'Your branch is behind remote.'
} else {
  Write-Warn 'Your branch has diverged.'
}
