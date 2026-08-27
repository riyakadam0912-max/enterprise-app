# Reports & Analytics Module - Critical Path Testing Guide

**Status:** ✅ All Compilation & Health Checks Passed  
**Date:** March 25, 2026  
**Prepared for:** User Acceptance Testing (UAT)  

---

## 📌 Executive Summary

The **Reports & Analytics Module** (Keka-like HR analytics) has been fully implemented with:
- ✅ **8 API endpoints** with role-based access control
- ✅ **4 chart components** for data visualization
- ✅ **3 data tables** for detailed reporting
- ✅ **Role-scoped access** (Admin/HR/Manager/Employee)
- ✅ **Zero compilation errors** & passing diagnostics
- ✅ **All endpoints verified** responding with authentication guards

**Time to validate:** 2-4 hours depending on test data setup

---

## 🎯 Critical Test Cases (Must Pass)

### TEST 1: Role Scoping Enforcement
**Purpose:** Ensure data is properly filtered by role  
**Severity:** 🔴 CRITICAL

```bash
# Scenario 1.1: Admin can see all employee attendance
curl -X GET 'http://localhost:3000/reports/attendance?month=3' \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# Expected: All 50 employees' data (if exists)

# Scenario 1.2: Manager can see only team attendance
curl -X GET 'http://localhost:3000/reports/attendance?month=3' \
  -H "Authorization: Bearer {MANAGER_TOKEN}"
# Expected: ~10 team members' data only

# Scenario 1.3: Employee can see only self data
curl -X GET 'http://localhost:3000/reports/attendance?month=3' \
  -H "Authorization: Bearer {EMPLOYEE_TOKEN}"
# Expected: Self attendance only (1 employee)

# Scenario 1.4: Employee cannot access another's data
curl -X GET 'http://localhost:3000/reports/attendance?employeeId=5' \
  -H "Authorization: Bearer {EMPLOYEE_TOKEN}"
# Expected: 403 Forbidden OR empty data
```

**Validation Rules:**
- ✓ Admin returns `count(employees) > 20`
- ✓ Manager returns `count(employees) <= team_size`
- ✓ Employee returns `count(employees) == 1`
- ✓ No cross-role data leakage

---

### TEST 2: Dashboard Aggregation Accuracy
**Purpose:** Verify calculations match source data  
**Severity:** 🟠 HIGH

```bash
# Get dashboard summary
curl -X GET 'http://localhost:3000/reports/dashboard?month=3' \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json"

# Expected response structure
{
  "summaryCards": {
    "totalEmployees": 45,        // Count from Employee table
    "presentToday": 38,           // Today's PRESENT status
    "payrollCost": 1250000,       // Sum of net payroll
    "attritionRate": 2.3          // (Left/AvgHeadcount)*100
  },
  "charts": {...},
  "tables": {...}
}
```

**Validation Rules:**
- ✓ `totalEmployees` = count(select * from Employee)
- ✓ `presentToday` = count(attendance where date=TODAY and status='PRESENT')
- ✓ `payrollCost` sum matches payroll entries for month
- ✓ `attritionRate` formula: `(employees_left_this_month / avg_headcount) * 100`

---

### TEST 3: Filter Parameter Processing
**Purpose:** Verify filters correctly narrow results  
**Severity:** 🟠 HIGH

```bash
# Test 3.1: Month filtering
curl -X GET 'http://localhost:3000/reports/attendance?month=1' \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# Expected: Records from January only

# Test 3.2: Department filtering
curl -X GET 'http://localhost:3000/reports/payroll?departments=Engineering,Sales' \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# Expected: Payroll data for Engineering+Sales only

# Test 3.3: Date range filtering
curl -X GET 'http://localhost:3000/reports/attendance?from=2026-03-01&to=2026-03-15' \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# Expected: Attendance records between dates (inclusive)

# Test 3.4: Combined filters
curl -X GET 'http://localhost:3000/reports/payroll?month=3&departments=Engineering' \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
# Expected: March payroll for Engineering only
```

**Validation Rules:**
- ✓ Single month returns 22-23 working days
- ✓ Date range respects boundaries
- ✓ Department filter includes only selected depts
- ✓ Filters combine with AND logic (not OR)

---

### TEST 4: Endpoint Response Shape
**Purpose:** Verify API returns expected JSON structure  
**Severity:** 🟠 HIGH

Required Response Fields:

```javascript
// GET /reports/dashboard
{
  summaryCards: {
    totalEmployees: number,
    presentToday: number,
    payrollCost: number,
    attritionRate: number
  },
  charts: {
    attendance: Array<{date, present, absent, leave}>,
    payroll: Array<{dept, cost, count}>,
    employeeGrowth: Array<{month, count}>,
    performanceDistribution: Array<{rating, count}>
  },
  tables: {
    topPerformers: Array<{name, rating, dept}>,
    recentHires: Array<{name, joinDate, dept}>,
    attendanceBreakdown: Array<{dept, present%, absent%, leave%}>
  }
}

// GET /reports/attendance
{
  data: Array<{
    employeeId: number,
    date: string (YYYY-MM-DD),
    status: "PRESENT" | "ABSENT" | "LEAVE",
    checkIn?: string (HH:MM),
    checkOut?: string (HH:MM),
    workingHours?: number,
    lateMinutes?: number
  }>,
  total: number,
  filtered: number  // optional for pagination
}

// GET /reports/payroll
{
  data: Array<{
    employeeId: number,
    month: number,
    year: number,
    grossSalary: number,
    deductions: number,
    netSalary: number,
    department: string
  }>,
  summary: {
    totalGross: number,
    totalDeductions: number,
    totalNet: number,
    headcount: number
  }
}
```

**Validation Rules:**
- ✓ All required fields present
- ✓ Data types match spec
- ✓ No null/undefined in critical fields
- ✓ Array counts are > 0 (with test data)

---

### TEST 5: Performance Baseline
**Purpose:** Verify response times acceptable  
**Severity:** 🟡 MEDIUM

```bash
# Cold cache (first request)
time curl -X GET 'http://localhost:3000/reports/dashboard' \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -w "\n%{time_total}s\n"
# Expected: 500-1000ms

# Warm cache (same request immediately)
time curl -X GET 'http://localhost:3000/reports/dashboard' \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -w "\n%{time_total}s\n"
# Expected: <100ms

# Heavy query (all depts, all employees, no cache)
time curl -X GET 'http://localhost:3000/reports/payroll' \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -w "\n%{time_total}s\n"
# Expected: <2000ms (2 seconds)
```

**Validation Rules:**
- ✓ Cold cache: < 1.0s
- ✓ Warm cache: < 0.1s
- ✓ Worst case: < 2.0s
- ✓ Avg response: 15-50ms per endpoint

---

### TEST 6: Authentication & Authorization
**Purpose:** Verify JWT guards and role checks  
**Severity:** 🔴 CRITICAL

```bash
# Test 6.1: No token
curl -X GET 'http://localhost:3000/reports/dashboard'
# Expected: 401 Unauthorized

# Test 6.2: Invalid token
curl -X GET 'http://localhost:3000/reports/dashboard' \
  -H "Authorization: Bearer invalid.token.here"
# Expected: 401 Unauthorized

# Test 6.3: Expired token
curl -X GET 'http://localhost:3000/reports/dashboard' \
  -H "Authorization: Bearer {EXPIRED_TOKEN}"
# Expected: 401 Unauthorized

# Test 6.4: Token with insufficient role
curl -X GET 'http://localhost:3000/reports/dashboard' \
  -H "Authorization: Bearer {EMPLOYEE_TOKEN}"
# Expected: 200 OK (with scoped data) OR 403 Forbidden (if admin-only)
```

**Validation Rules:**
- ✓ Missing token → 401
- ✓ Invalid token → 401  
- ✓ Expired token → 401
- ✓ Wrong role → 403 or scoped data

---

### TEST 7: Frontend Dashboard Rendering
**Purpose:** Verify UI displays correctly  
**Severity:** 🟡 MEDIUM

1. **Open Dashboard** (logged in as Admin)
   ```
   Navigate to: http://localhost:3001/dashboard/reports
   ```

2. **Verify Components Load** ✓
   - [ ] Summary cards display (Total Employees, Present Today, Payroll, Attrition)
   - [ ] 4 chart components render (Attendance, Payroll, Growth, Performance)
   - [ ] 3 data tables visible (Top Performers, Recent Hires, Attendance Breakdown)
   - [ ] No console errors in DevTools

3. **Test Filters** ✓
   - [ ] Month selector changes data
   - [ ] Department multi-select filters charts
   - [ ] Employee autocomplete works (if visible)
   - [ ] Data refreshes on filter change (<2s)

4. **Test Responsiveness** ✓
   - [ ] Mobile (320px): Stacked layout, readable
   - [ ] Tablet (768px): 2-column charts, good spacing
   - [ ] Desktop (1200px): 4-column grid, proper alignment

5. **Test Chart Interactions** ✓
   - [ ] Hover shows tooltip with data
   - [ ] Charts render actual data (not placeholder)
   - [ ] Colors distinguish categories
   - [ ] Legend works if present

---

## 🧪 Quick Test Execution Checklist

### Setup (30 min)
- [ ] Backend API running: `cd api && npm run start:dev`
- [ ] Frontend running: `cd web && npm run dev`
- [ ] Test database seeded with sample data
- [ ] JWT tokens generated for test users (Admin, HR, Manager, Employee)

### Smoke Tests (1 hour)
- [ ] Run TEST 1: Role scoping (4 curl commands)
- [ ] Run TEST 2: Dashboard aggregation (1 request + manual validation)
- [ ] Run TEST 3: Filter parameters (4 curl commands)
- [ ] Run TEST 4: Response shapes (check JSON structure)

### Performance Tests (15 min)
- [ ] Run TEST 5: Performance baseline (3 timing tests)
- [ ] Record results in performance log
- [ ] Compare against expected metrics

### Security Tests (15 min)
- [ ] Run TEST 6: Auth & authorization (4 curl commands)
- [ ] Verify all 401/403 responses correct

### Frontend Tests (30 min)
- [ ] Run TEST 7: Dashboard rendering (9 checkboxes)
- [ ] Test all filter combinations
- [ ] Check responsive design on 3 screen sizes

### Post-Test Review (30 min)
- [ ] Document any failures with screenshots
- [ ] Verify role scoping: no data leakage
- [ ] Confirm calculations accuracy
- [ ] Performance within SLA

---

## 📋 Test Results Template

```markdown
# Test Results - [DATE]

## Environment
- Backend: ✓ Running
- Frontend: ✓ Running  
- Database: ✓ Seeded
- Test Users: ✓ Created

## Critical Path Tests
| Test | Status | Notes |
|------|--------|-------|
| Role Scoping | PASS/FAIL | |
| Dashboard Accuracy | PASS/FAIL | |
| Filter Processing | PASS/FAIL | |
| Response Shapes | PASS/FAIL | |
| Authentication | PASS/FAIL | |
| Authorization | PASS/FAIL | |
| Frontend Rendering | PASS/FAIL | |

## Performance Metrics
| Endpoint | Cold Cache | Warm Cache | Notes |
|----------|-----------|-----------|-------|
| /reports/dashboard | XXms | XXms | |
| /reports/attendance | XXms | XXms | |
| /reports/payroll | XXms | XXms | |

## Issues Found
- [ ] Critical (Blocks deployment)
- [ ] High (Must fix)
- [ ] Medium (Should fix)
- [ ] Low (Nice to have)

## Sign-off
- Tester: _______
- Date: _______
- Status: ✅ APPROVED / ⚠️ CONDITIONAL / ❌ REJECTED
```

---

## 🚨 Failure Troubleshooting

### Dashboard returns 401 Unauthorized
**Cause:** Invalid/expired JWT token  
**Fix:** Generate new token from `/auth/login` endpoint

### Charts show no data
**Cause:** Insufficient test data in database  
**Fix:** Seed database with 60+ days of attendance/payroll records

### Role scoping not working
**Cause:** JWT token missing role claim  
**Fix:** Verify token includes `{ role: "ADMIN" }` in payload

### Filter parameters ignored
**Cause:** Query string not recognized  
**Fix:** Check exact parameter names in endpoint spec

### Performance degradation
**Cause:** Large dataset without pagination  
**Fix:** Implement pagination or reduce date range

### Frontend charts blank
**Cause:** API response format unexpected  
**Fix:** Check response shape matches TEST 4 specification

---

## 📞 Support Resources

| Resource | Location |
|----------|----------|
| Detailed Tests | `REPORTS_ANALYTICS_SMOKE_TESTS.md` |
| Implementation Summary | `REPORTS_ANALYTICS_IMPLEMENTATION_SUMMARY.md` |
| Backend Code | `api/src/reports/` |
| Frontend Code | `web/src/api/reportsApi.ts`, `web/app/dashboard/reports/` |
| Health Check | `node api/test-reports-health.js` |

---

**Last Updated:** March 25, 2026  
**Status:** Ready for UAT ✅  
**Expected Duration:** 2-4 hours total testing  
