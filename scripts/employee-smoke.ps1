$ErrorActionPreference='Stop'
$loginBody = @{ email = 'employee.1@enterprise.local'; password = 'password123' } | ConvertTo-Json
$loginResp = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/v1/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
if (-not $loginResp.success) { throw "LOGIN FAILED: $($loginResp.message)" }
$token = $loginResp.data.accessToken
Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] Login OK (token length $($token.Length))"
$header = @{ Authorization = "Bearer $token" }

$uiRoutes = @(
  '/dashboard',
  '/dashboard/timesheets',
  '/dashboard/attendance',
  '/dashboard/leads',
  '/dashboard/deals',
  '/dashboard/requests',
  '/dashboard/expenses',
  '/dashboard/projects',
  '/dashboard/tasks',
  '/dashboard/contacts',
  '/dashboard/payroll',
  '/dashboard/payslips',
  '/dashboard/files',
  '/dashboard/notifications',
  '/dashboard/profile',
  '/dashboard/reports',
  '/dashboard/leave',
  '/dashboard/performance',
  '/dashboard/tickets',
  '/dashboard/campaign-leads',
  '/dashboard/events',
  '/dashboard/activities',
  '/ess/attendance',
  '/ess/leave',
  '/ess/payslips',
  '/ess/profile',
  '/ess/expenses',
  '/notifications',
  '/notifications/preferences'
)
foreach ($r in $uiRoutes) {
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:3001$r" -UseBasicParsing -Method GET
    Write-Host "UI 200 $r"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "UI FAIL $r -> HTTP $code $($_.Exception.Message.Substring(0,[Math]::Min(80,$_.Exception.Message.Length)))"
  }
}

$apiRoutes = @(
  @{ method='GET'; path='/api/v1/auth/me' },
  @{ method='GET'; path='/api/v1/employees/me' },
  @{ method='GET'; path='/api/v1/attendance/my' },
  @{ method='GET'; path='/api/v1/attendance/summary?month=2026-08&employeeId=3' },
  @{ method='GET'; path='/api/v1/tasks?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/projects?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/expenses?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/timesheets?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/requests?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/contacts?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/payslips?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/notifications?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/notifications/unread-count' },
  @{ method='GET'; path='/api/v1/analytics/summary' },
  @{ method='GET'; path='/api/v1/dashboard/summary' }
)
Write-Host "---- API (employee allowed routes) ----"
foreach ($a in $apiRoutes) {
  try {
    $resp = Invoke-RestMethod -Headers $header -Uri "http://127.0.0.1:3000$($a.path)" -Method $a.method
    $ok = if ($resp.success) { 'OK' } else { "MSG=$($resp.message)" }
    Write-Host "API 200 $($a.method) $($a.path) -> $ok"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "API FAIL $($a.method) $($a.path) -> HTTP $code"
  }
}

Write-Host "---- API (employee FORBIDDEN routes) ----"
$forbidden = @(
  @{ method='GET'; path='/api/v1/users' },
  @{ method='GET'; path='/api/v1/organizations' },
  @{ method='GET'; path='/api/v1/employees?page=1&limit=10' },
  @{ method='GET'; path='/api/v1/audit-logs' },
  @{ method='GET'; path='/api/v1/rbac/roles' },
  @{ method='GET'; path='/api/v1/rbac/permissions' },
  @{ method='GET'; path='/api/v1/settings' },
  @{ method='GET'; path='/api/v1/admin/dashboard' },
  @{ method='GET'; path='/api/v1/super-admin/plans' },
  @{ method='GET'; path='/api/v1/super-admin/billing' },
  @{ method='GET'; path='/api/v1/reports/all' },
  @{ method='POST'; path='/api/v1/employees' },
  @{ method='DELETE'; path='/api/v1/users/1' },
  @{ method='GET'; path='/api/v1/mail/health' }
)
foreach ($a in $forbidden) {
  try {
    $resp = Invoke-RestMethod -Headers $header -Uri "http://127.0.0.1:3000$($a.path)" -Method $a.method
    $sc = 200
    Write-Host "LEAK $($a.method) $($a.path) -> HTTP $sc (REJECTED)"
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 401 -or $code -eq 403 -or $code -eq 404 -or $code -eq 405) {
      Write-Host "OK_BLOCK $($a.method) $($a.path) -> HTTP $code"
    } else {
      Write-Host "WEIRD $($a.method) $($a.path) -> HTTP $code"
    }
  }
}
Write-Host "---- DONE ----"
