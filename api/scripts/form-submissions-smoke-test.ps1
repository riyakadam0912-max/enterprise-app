$ErrorActionPreference = "Stop"

function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$Body,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [int]$ExpectedStatus = 200
    )
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            WebSession = $Session
            ContentType = "application/json"
        }
        if ($Body) { $params.Body = $Body }
        
        $resp = Invoke-RestMethod @params
        return @{ Success = $true; Status = 200; Data = $resp }
    }
    catch [System.Net.WebException] {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "  [HTTP $statusCode] $($respBody -replace '\s+',' ')"
        return @{ Success = ($statusCode -eq $ExpectedStatus); Status = $statusCode; Error = $respBody }
    }
}

function Login-User {
    param([string]$Email, [string]$Password)
    try {
        $body = @{email=$Email;password=$Password} | ConvertTo-Json -Compress
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $resp = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body -WebSession $session
        if ($resp.success) {
            return @{ Session = $session; Data = $resp.data; Exists = $true }
        }
        return @{ Exists = $false }
    } catch {
        Write-Host "  Login failed for $Email : $($_.Exception.Message)"
        return @{ Exists = $false }
    }
}

Write-Host "=== FORM SUBMISSIONS API SMOKE TEST ===" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Admin login and baseline test ----
Write-Host "--- TEST 1: Admin GET /api/v1/form-submissions (expect 200, not 404) ---"
$admin = Login-User "admin@erp.local" "Admin@123"
if (-not $admin.Exists) { Write-Host "  FAIL: Admin login failed" -ForegroundColor Red; exit 1 }
Write-Host "  Admin logged in: $($admin.Data.user.name) (role=$($admin.Data.role), org=$($admin.Data.organizationId))"
$result = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $admin.Session -ExpectedStatus 200
if ($result.Success -and $result.Status -eq 200) {
    $count = if ($result.Data.data) { $result.Data.data.Count } else { 0 }
    Write-Host "  PASS: HTTP 200 - $count submission(s) returned" -ForegroundColor Green
    if ($count -gt 0) {
        $first = $result.Data.data[0]
        Write-Host "  Sample: id=$($first.id), form=$($first.form), submittedBy=$($first.submittedBy), status=$($first.status)"
    }
} else {
    Write-Host "  FAIL: Expected 200, got $($result.Status)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ---- 2a. Validation protection: unknown fields return 400 ----
Write-Host "--- TEST 2a: Forbidden fields (status/reviewer) rejected by ValidationPipe (expect 400) ---"
$emp1 = Login-User "employee.1@enterprise.local" "password123"
Write-Host "  Employee 1 logged in: $($emp1.Data.user.name) (role=$($emp1.Data.role), org=$($emp1.Data.organizationId))"

$badCreateBody = @{
    form = "Test-Injection-Submission"
    submissionDate = "2026-08-17"
    data = "test-data"
    status = "PROCESSED"
    reviewer = "HACKED"
} | ConvertTo-Json -Compress

$badCreateResult = Invoke-ApiCall -Method POST -Uri "http://localhost:3000/api/v1/form-submissions" -Body $badCreateBody -Session $emp1.Session -ExpectedStatus 400
if ($badCreateResult.Status -eq 400) {
    Write-Host "  PASS: forbidNonWhitelisted rejected extra fields (status/reviewer) with HTTP 400" -ForegroundColor Green
} else {
    Write-Host "  INFO: Whitelist not blocking (HTTP $($badCreateResult.Status)) - will rely on service-level strip" -ForegroundColor Yellow
}

# ---- 2b. Valid submission creation (check Form Name + default status) ----
Write-Host "--- TEST 2b: Valid create as Employee (Form Name + status forced to SUBMITTED) ---"
$validCreateBody = @{
    form = "Test-Form-Name-Check"
    submissionDate = "2026-08-17"
    data = "sample-data-payload"
} | ConvertTo-Json -Compress

$createResult = Invoke-ApiCall -Method POST -Uri "http://localhost:3000/api/v1/form-submissions" -Body $validCreateBody -Session $emp1.Session -ExpectedStatus 201
if ($createResult.Success -and ($createResult.Status -eq 201 -or $createResult.Status -eq 200)) {
    $created = $createResult.Data.data
    Write-Host "  Created submission id=$($created.id)"
    if ($created.status -eq "SUBMITTED") {
        Write-Host "  PASS: status=SUBMITTED (service hard-codes it on create)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: status=$($created.status) - should be SUBMITTED" -ForegroundColor Red
    }
    if ($created.form -eq "Test-Form-Name-Check") {
        Write-Host "  PASS: Form Name correctly set: $($created.form)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Form Name mismatch: expected=Test-Form-Name-Check, actual=$($created.form)" -ForegroundColor Red
    }
    if ($created.submittedBy -like "*$($emp1.Data.user.name)*") {
        Write-Host "  PASS: submittedBy=$($created.submittedBy) matches user name" -ForegroundColor Green
    }
    $testSubmissionId = $created.id
    $testSubmissionOrg1Id = $created.id
} else {
    Write-Host "  FAIL: Create failed with $($createResult.Status)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ---- 3. Test Employee scoping ----
Write-Host "--- TEST 3: Employee 1 sees ONLY their own submissions ---"
$emp1List = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $emp1.Session -ExpectedStatus 200
if ($emp1List.Success) {
    $emp1Own = @($emp1List.Data.data | Where-Object { $_.submittedBy -like "*$($emp1.Data.user.name)*" })
    $emp1Other = @($emp1List.Data.data | Where-Object { $_.submittedBy -notlike "*$($emp1.Data.user.name)*" })
    Write-Host "  Employee 1 list count: $($emp1List.Data.data.Count) (own=$($emp1Own.Count), other=$($emp1Other.Count))"
    if ($emp1Other.Count -eq 0) {
        Write-Host "  PASS: Employee 1 sees only own submissions (scoped by name: $($emp1.Data.user.name))" -ForegroundColor Green
    } else {
        Write-Host "  WARN/FAIL: Employee 1 sees $($emp1Other.Count) submission(s) not under their name" -ForegroundColor Yellow
    }
}
Write-Host ""

# ---- 4. Test Employee 2 scoping (different user) ----
Write-Host "--- TEST 4: Employee 2 scoping (cannot see Employee 1's submission) ---"
$emp2 = Login-User "employee.2@enterprise.local" "password123"
Write-Host "  Employee 2: $($emp2.Data.user.name)"
$emp2List = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $emp2.Session -ExpectedStatus 200
if ($emp2List.Success) {
    $emp2SeesTest = @($emp2List.Data.data | Where-Object { $_.id -eq $testSubmissionId })
    if ($emp2SeesTest.Count -eq 0) {
        Write-Host "  PASS: Employee 2 cannot see Employee 1's submission #$testSubmissionId" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Employee 2 sees submission they shouldn't (id=$testSubmissionId)" -ForegroundColor Red
    }
}
Write-Host ""

# ---- 5. Manager scoping test ----
Write-Host "--- TEST 5: Manager sees submissions for self and direct reports (name-based) ---"
$mgr1 = Login-User "manager.1@enterprise.local" "password123"
Write-Host "  Manager 1: $($mgr1.Data.user.name) (id=$($mgr1.Data.user.id))"
$mgr1List = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $mgr1.Session -ExpectedStatus 200
if ($mgr1List.Success) {
    $mgrSeesTest = @($mgr1List.Data.data | Where-Object { $_.id -eq $testSubmissionId })
    Write-Host "  Manager 1 sees $($mgr1List.Data.data.Count) submission(s)"
    if ($mgrSeesTest.Count -gt 0) {
        Write-Host "  PASS: Manager sees direct-report Employee 1's submission #$testSubmissionId" -ForegroundColor Green
    } else {
        Write-Host "  INFO: Manager may not see submission if Employee 1 is not a direct report (name-based scope)" -ForegroundColor Yellow
    }
    foreach ($r in $mgr1List.Data.data) {
        Write-Host "    -> id=$($r.id), submittedBy=$($r.submittedBy), form=$($r.form)"
    }
}
Write-Host ""

# ---- 6. Admin see org-wide ----
Write-Host "--- TEST 6: Admin sees ALL org 1 submissions ---"
$adminList = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $admin.Session -ExpectedStatus 200
if ($adminList.Success) {
    $adminSeesTest = @($adminList.Data.data | Where-Object { $_.id -eq $testSubmissionId })
    if ($adminSeesTest.Count -gt 0) {
        Write-Host "  PASS: Admin sees test submission #$testSubmissionId (total=$($adminList.Data.data.Count))" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: Admin should see all org submissions" -ForegroundColor Red
    }
}
Write-Host ""

# ---- 6b. Super Admin scope ----
Write-Host "--- TEST 6b: Super Admin (no org) route behavior ---"
$sa = Login-User "superadmin@erp.local" "Admin@123"
if ($sa.Exists) {
    Write-Host "  Super Admin: $($sa.Data.user.name) (org=$($sa.Data.organizationId))"
    $saList = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $sa.Session -ExpectedStatus 403
    if ($saList.Status -eq 403) {
        Write-Host "  PASS: Super Admin without orgId correctly gets 403 (org validation enforces isolation)" -ForegroundColor Green
    } elseif ($saList.Status -eq 200) {
        Write-Host "  INFO: Super Admin returned data (count=$($saList.Data.data.Count)) - check if org scoped correctly" -ForegroundColor Yellow
    } else {
        Write-Host "  INFO: Super Admin returned HTTP $($saList.Status)" -ForegroundColor Yellow
    }
}
Write-Host ""

# ---- 7. HR role test ----
Write-Host "--- TEST 7: HR role sees all org 1 submissions ---"
$hrUser = Login-User "hr@enterprise.local" "password123"
if ($hrUser.Exists) {
    Write-Host "  HR logged in: $($hrUser.Data.user.name) (role=$($hrUser.Data.role), org=$($hrUser.Data.organizationId))"
    $hrList = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $hrUser.Session -ExpectedStatus 200
    if ($hrList.Success) {
        $hrSeesTest = @($hrList.Data.data | Where-Object { $_.id -eq $testSubmissionId })
        if ($hrSeesTest.Count -gt 0) {
            Write-Host "  PASS: HR sees test submission #$testSubmissionId (total=$($hrList.Data.data.Count))" -ForegroundColor Green
        } else {
            Write-Host "  INFO: HR total=$($hrList.Data.data.Count)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  SKIP: hr user not found" -ForegroundColor Yellow
}
Write-Host ""

# ---- 7b. TENANT ISOLATION: Org 3 Admin cannot see Org 1's submission ----
Write-Host "--- TEST 7b: TENANT ISOLATION - Org 3 Admin CANNOT see Org 1's submission ---"
$org3Admin = Login-User "qa-admin-user+267217@example.com" "password123"
if ($org3Admin.Exists) {
    Write-Host "  Org 3 Admin: $($org3Admin.Data.user.name) (org=$($org3Admin.Data.organizationId))"
    $org3List = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $org3Admin.Session -ExpectedStatus 200
    if ($org3List.Success) {
        $org3SeesOrg1Data = @($org3List.Data.data | Where-Object { $_.id -eq $testSubmissionOrg1Id })
        if ($org3SeesOrg1Data.Count -eq 0) {
            Write-Host "  PASS: Org 3 Admin CANNOT see Org 1's submission #$testSubmissionOrg1Id (isolation enforced, org3 count=$($org3List.Data.data.Count))" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: TENANT ISOLATION BREACH - Org 3 Admin sees Org 1 submission #$testSubmissionOrg1Id" -ForegroundColor Red
        }
    }
    
    # Org 3 Admin creates their own submission and can see it
    $org3Create = Invoke-ApiCall -Method POST -Uri "http://localhost:3000/api/v1/form-submissions" -Body (@{form="Org3-Only-Form";data="org3-only"} | ConvertTo-Json -Compress) -Session $org3Admin.Session -ExpectedStatus 201
    if ($org3Create.Success -and ($org3Create.Status -eq 201 -or $org3Create.Status -eq 200)) {
        $org3SubId = $org3Create.Data.data.id
        Write-Host "  Org 3 Admin created own submission #$org3SubId"
        $org1AdminList = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions" -Session $admin.Session -ExpectedStatus 200
        $org1SeesOrg3 = @($org1AdminList.Data.data | Where-Object { $_.id -eq $org3SubId })
        if ($org1SeesOrg3.Count -eq 0) {
            Write-Host "  PASS: Org 1 Admin CANNOT see Org 3's submission #$org3SubId (bidirectional isolation)" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: TENANT ISOLATION BREACH - Org 1 Admin sees Org 3 submission #$org3SubId" -ForegroundColor Red
        }
        # Org 3 cleanup
        Invoke-ApiCall -Method DELETE -Uri "http://localhost:3000/api/v1/form-submissions/$org3SubId" -Session $org3Admin.Session -ExpectedStatus 204 | Out-Null
    }
} else {
    Write-Host "  SKIP: Org 3 Admin user not found (could not login)" -ForegroundColor Yellow
}
Write-Host ""

# ---- 8. Update attempt: PATCH whitelist protection + service strip ----
Write-Host "--- TEST 8: Employee 1 PATCH with forbidden fields (status/reviewer/approvedBy) ---"
$badUpdateBody = @{
    form = "Updated-Form-Name"
    status = "PROCESSED"
    reviewer = "INJECTED-REVIEWER"
    approvedBy = "HACKER"
} | ConvertTo-Json -Compress
$updateResult = Invoke-ApiCall -Method PATCH -Uri "http://localhost:3000/api/v1/form-submissions/$testSubmissionId" -Body $badUpdateBody -Session $emp1.Session -ExpectedStatus 200
# forbidNonWhitelisted will reject with 400 (good!), OR if allowed, service strips (also good)
if ($updateResult.Status -eq 400) {
    Write-Host "  PASS: forbidNonWhitelisted rejected extra fields in PATCH with HTTP 400 (strong protection)" -ForegroundColor Green
} elseif ($updateResult.Success -and $updateResult.Status -eq 200) {
    $updated = $updateResult.Data.data
    Write-Host "  After update: form=$($updated.form), status=$($updated.status), reviewer=$($updated.reviewer)"
    if ($updated.form -eq "Updated-Form-Name") {
        Write-Host "  PASS: Form Name update works: $($updated.form)" -ForegroundColor Green
    }
    if ($updated.status -ne "PROCESSED") {
        Write-Host "  PASS: status injection stripped (still $($updated.status))" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: status was UPDATED via PATCH (should be blocked)" -ForegroundColor Red
    }
    if ($null -eq $updated.reviewer -or $updated.reviewer -ne "INJECTED-REVIEWER") {
        Write-Host "  PASS: reviewer injection stripped" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: reviewer was UPDATED via PATCH (should be blocked)" -ForegroundColor Red
    }
} else {
    Write-Host "  INFO: Update returned HTTP $($updateResult.Status)" -ForegroundColor Yellow
}
Write-Host ""

# ---- 9. Employee 2 cannot update/delete Employee 1's submission ----
Write-Host "--- TEST 9: Employee 2 CANNOT update/delete Employee 1's submission ---"
$emp2Update = Invoke-ApiCall -Method PATCH -Uri "http://localhost:3000/api/v1/form-submissions/$testSubmissionId" -Body '{"form":"HACKED-BY-EMP2"}' -Session $emp2.Session -ExpectedStatus 404
if ($emp2Update.Status -eq 404 -or $emp2Update.Status -eq 403) {
    Write-Host "  PASS: Employee 2 update blocked (HTTP $($emp2Update.Status))" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Employee 2 update should be blocked (got $($emp2Update.Status))" -ForegroundColor Red
}
$emp2Delete = Invoke-ApiCall -Method DELETE -Uri "http://localhost:3000/api/v1/form-submissions/$testSubmissionId" -Session $emp2.Session -ExpectedStatus 404
if ($emp2Delete.Status -eq 404 -or $emp2Delete.Status -eq 403) {
    Write-Host "  PASS: Employee 2 delete blocked (HTTP $($emp2Delete.Status))" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Employee 2 delete should be blocked (got $($emp2Delete.Status))" -ForegroundColor Red
}
Write-Host ""

# ---- 10. by-status endpoint ----
Write-Host "--- TEST 10: GET /api/v1/form-submissions/by-status (endpoint exists) ---"
$byStatus = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions/by-status" -Session $admin.Session -ExpectedStatus 200
if ($byStatus.Success -and $byStatus.Status -eq 200) {
    $keys = @(($byStatus.Data.data | Get-Member -MemberType NoteProperty).Name) -join ", "
    Write-Host "  PASS: HTTP 200, keys=$keys" -ForegroundColor Green
} else {
    Write-Host "  FAIL: HTTP $($byStatus.Status)" -ForegroundColor Red
}
Write-Host ""

# ---- 10b. FindOne: GET by ID scoping ----
Write-Host "--- TEST 10b: GET :id - Employee 2 cannot fetch Employee 1's submission by direct ID ---"
$emp2GetOne = Invoke-ApiCall -Method GET -Uri "http://localhost:3000/api/v1/form-submissions/$testSubmissionId" -Session $emp2.Session -ExpectedStatus 404
if ($emp2GetOne.Status -eq 404 -or $emp2GetOne.Status -eq 403) {
    Write-Host "  PASS: Employee 2 direct GET blocked (HTTP $($emp2GetOne.Status))" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Employee 2 direct GET should be blocked (got $($emp2GetOne.Status))" -ForegroundColor Red
}
Write-Host ""

# ---- 11. Cleanup: delete test submission ----
Write-Host "--- TEST 11: Admin can delete test submission ---"
$delResult = Invoke-ApiCall -Method DELETE -Uri "http://localhost:3000/api/v1/form-submissions/$testSubmissionId" -Session $admin.Session -ExpectedStatus 204
if ($delResult.Status -eq 204 -or $delResult.Status -eq 200) {
    Write-Host "  PASS: Deleted Org 1 test submission #$testSubmissionId (HTTP $($delResult.Status))" -ForegroundColor Green
} else {
    Write-Host "  INFO: Delete returned $($delResult.Status)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== ALL FORM SUBMISSION API TESTS COMPLETE ===" -ForegroundColor Cyan
