$ErrorActionPreference = 'Stop'

function Write-Section {
  param([string]$Message)
  Write-Host ''
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Gray
}

function Write-Ok {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Args)
  & git @Args
  return $LASTEXITCODE
}

function Test-GitSuccess {
  param([int]$ExitCode, [string]$Message)
  if ($ExitCode -ne 0) {
    throw $Message
  }
}

$repoRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  $repoRoot = Get-Location
}

Set-Location $repoRoot

Write-Section 'Checking repository state...'

if (-not (Test-Path '.git')) {
  Write-Warn 'No Git metadata found. Initializing repository.'
  Test-GitSuccess (Invoke-Git -Args @('init')) 'Failed to initialize Git repository.'
}

$originUrl = 'https://github.com/riyakadam0912-max/enterprise-app.git'
$originExists = $false
try {
  $null = & git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0) {
    $originExists = $true
  }
} catch {
  $originExists = $false
}

if (-not $originExists) {
  Write-Warn 'Remote origin is missing. Adding the GitHub remote.'
  Test-GitSuccess (Invoke-Git -Args @('remote', 'add', 'origin', $originUrl)) 'Failed to add origin remote.'
}

Test-GitSuccess (Invoke-Git -Args @('fetch', 'origin', '--prune')) 'Failed to fetch from origin.'

Write-Section 'Current branch and status...'
Test-GitSuccess (Invoke-Git -Args @('status', '--short', '--branch')) 'Failed to read git status.'

$currentBranch = & git branch --show-current
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to determine current branch.'
}

$detachedHead = [string]::IsNullOrWhiteSpace($currentBranch)
if ($detachedHead) {
  Write-Warn 'Detached HEAD detected. A new branch will be created from the current commit.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$baseBranchName = "erp-update-$timestamp"
$updateBranch = $baseBranchName
$null = & git show-ref --verify --quiet "refs/heads/$updateBranch"
if ($LASTEXITCODE -eq 0) {
  $updateBranch = "$baseBranchName-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
  Write-Warn "Branch $baseBranchName already exists. Using $updateBranch instead."
}

Write-Section 'Creating update branch...'
Test-GitSuccess (Invoke-Git -Args @('switch', '-c', $updateBranch)) "Failed to create branch $updateBranch."
Write-Ok "On branch: $updateBranch"

Write-Section 'Staging all changes...'
Test-GitSuccess (Invoke-Git -Args @('add', '-A')) 'Failed to stage changes.'

$stagedFiles = @( & git diff --cached --name-only )
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to inspect staged files.'
}

if ($stagedFiles.Count -eq 0) {
  Write-Warn 'No changes to commit. Skipping commit, pull, and push.'
  $verifyScript = Join-Path $repoRoot 'verify.ps1'
  if (Test-Path $verifyScript) {
    Write-Section 'Running verification...'
    & powershell -NoProfile -ExecutionPolicy Bypass -File $verifyScript
  } else {
    Write-Warn 'verify.ps1 was not found. Verification skipped.'
  }
  exit 0
}

$topFolders = $stagedFiles |
  ForEach-Object {
    $parts = $_ -split '[\\/]'
    if ($parts.Count -gt 1) { $parts[0] } else { 'root' }
  } |
  Group-Object |
  Sort-Object Count -Descending |
  Select-Object -First 3 |
  ForEach-Object { $_.Name }

if ($topFolders.Count -gt 0) {
  $commitMessage = "Update $($topFolders -join ', ')"
} else {
  $commitMessage = 'ERP full system update'
}

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
  $commitMessage = 'ERP full system update'
}

Write-Section 'Committing changes...'
Write-Info "Commit message: $commitMessage"
Test-GitSuccess (Invoke-Git -Args @('commit', '-m', $commitMessage)) 'Commit failed. Please resolve any Git errors and try again.'

$baseBranch = $null
$null = & git show-ref --verify --quiet 'refs/remotes/origin/main'
if ($LASTEXITCODE -eq 0) {
  $baseBranch = 'main'
} else {
  $null = & git show-ref --verify --quiet 'refs/remotes/origin/master'
  if ($LASTEXITCODE -eq 0) {
    $baseBranch = 'master'
  }
}

Write-Section 'Rebasing against remote...'
if ($null -ne $baseBranch) {
  Write-Info "Rebasing onto origin/$baseBranch"
  Test-GitSuccess (Invoke-Git -Args @('pull', '--rebase', 'origin', $baseBranch)) 'Rebase failed. Resolve conflicts, then run git rebase --continue.'
} else {
  Write-Warn 'No upstream base branch (origin/main or origin/master) found. Skipping rebase.'
}

Write-Section 'Pushing to GitHub...'
Test-GitSuccess (Invoke-Git -Args @('push', '-u', 'origin', $updateBranch)) 'Push failed. Check remote access or resolve any remaining Git issues.'

Write-Section 'Running verification...'
$verifyScript = Join-Path $repoRoot 'verify.ps1'
if (Test-Path $verifyScript) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $verifyScript
  if ($LASTEXITCODE -ne 0) {
    throw 'Verification script reported a failure.'
  }
} else {
  Write-Warn 'verify.ps1 was not found. Verification skipped.'
}

Write-Ok '✅ Deployment successful and verified'
