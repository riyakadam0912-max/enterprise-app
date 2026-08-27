# Reports & Analytics Module - Smoke Test Suite

**Date:** March 25, 2026  
**Module:** Reports & Analytics (Keka-like HR Analytics)  
**Status:** Ready for UAT Validation  

---

## Test Environment

- **Backend API:** http://localhost:3000
- **Frontend:** http://localhost:3001
- **Database:** PostgreSQL (via Prisma)
- **Auth:** JWT-based with role guards

---

## Prerequisites

1. Backend API running (`npm run start:dev`)
2. Valid JWT tokens for test users with roles:
   - `ADMIN` (full access)
   - `HR` (HR module access)
   - `MANAGER` (team views only)
   - `EMPLOYEE` (self views only)
3. Sample data in database (employees, attendance, payroll, performance records)

---

## Test Cases

### 1. Role-Based Access Control (RBAC) Tests

#### 1.1 Admin Role Access
```bash
# Admin can access all reports endpoints
curl -X GET http://localhost:3000/reports/dashboard \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with full dashboard aggregation
```

**Expected Response:**
```json
{
  "summaryCards": {
    "totalEmployees": 45,
    "presentToday": 40,
    "payrollCost": 1250000,
    "attritionRate": 2.5
  },
  "charts": {
    "attendance": [...],
    "payroll": [...],
    "employeeGrowth": [...],
    "performanceDistribution": [...]
  },
  "tables": {
    "topPerformers": [...],
    "recentHires": [...],
    "attendanceBreakdown": [...]
  }
}
```

#### 1.2 HR Role Access
```bash
# HR can access all reports except certain admin-only views
curl -X GET http://localhost:3000/reports/attendance \
  -H "Authorization: Bearer {HR_JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with attendance data for all employees
```

#### 1.3 Manager Role Access (Scoped to Team)
```bash
# Manager can only see reports for their team members
curl -X GET http://localhost:3000/reports/payroll \
  -H "Authorization: Bearer {MANAGER_JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with payroll data filtered by manager's team only
# Request body or query params should filter by managerId
```

#### 1.4 Employee Role Access (Self Only)
```bash
# Employee can only see their own performance review
curl -X GET http://localhost:3000/reports/performance \
  -H "Authorization: Bearer {EMPLOYEE_JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with only self performance data
# Should be scoped by employeeId from JWT context
```

---

### 2. Endpoint Coverage Tests

#### 2.1 Attendance Reports
```bash
# Daily Attendance Report with date range filter
curl -X GET "http://localhost:3000/reports/attendance/daily?from=2026-03-01&to=2026-03-25" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Department-wise Attendance
curl -X GET "http://localhost:3000/reports/attendance/departments?month=3" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: daily breakdown and dept aggregation
```

#### 2.2 Payroll Reports
```bash
# Monthly Payroll Summary
curl -X GET "http://localhost:3000/reports/payroll?month=3" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Payroll by Department
curl -X GET "http://localhost:3000/reports/payroll/departments?month=3" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Payroll Trends (multi-month)
curl -X GET "http://localhost:3000/reports/payroll/trends?from=2026-01&to=2026-03" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: gross salary, deductions, net pay aggregations
```

#### 2.3 Turnover / Attrition Reports
```bash
# Employee Turnover Summary
curl -X GET "http://localhost:3000/reports/turnover" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: attrition rate, recent exits, tenure distribution
```

#### 2.4 Performance Reports
```bash
# Performance Metrics and Distributions
curl -X GET "http://localhost:3000/reports/performance" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: rating distribution, peer avg, goal completion %
```

#### 2.5 Unified Dashboard
```bash
# Comprehensive Dashboard with all metrics
curl -X GET "http://localhost:3000/reports/dashboard?month=3&department=Engineering" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: combined summary cards + all chart data + top performers table
```

---

### 3. Filter & Query Tests

#### 3.1 Date Range Filtering
```bash
# Test with from/to date parameters
curl -X GET "http://localhost:3000/reports/attendance?from=2026-03-01&to=2026-03-25" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Validation:
# - Returned data should only include records within [from, to]
# - Date format should be YYYY-MM-DD
```

#### 3.2 Department Filtering
```bash
curl -X GET "http://localhost:3000/reports/payroll?departments=Engineering,Sales" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Validation:
# - Response filtered to Engineering and Sales depts only
```

#### 3.3 Employee Scoping
```bash
# Specific employee (if permitted by role)
curl -X GET "http://localhost:3000/reports/attendance?employeeId=5" \
  -H "Authorization: Bearer {MANAGER_JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Validation:
# - Manager can see team member ID 5
# - Should return 403 if trying to access employee outside their team
```

#### 3.4 Month Shorthand
```bash
curl -X GET "http://localhost:3000/reports/payroll?month=3" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Validation:
# - Month=3 → March 2026 (current year)
# - Should cover full month: 2026-03-01 to 2026-03-31
```

---

### 4. Data Accuracy Tests

#### 4.1 Attendance Calculations
- [ ] Present Days count matches actual PRESENT records
- [ ] Absent Days count matches ABSENT records
- [ ] Paid Leave deduction applied correctly to salary
- [ ] Unpaid Leave deduction applied correctly

#### 4.2 Payroll Aggregations
- [ ] Gross Pay = Basic + HRA + Allowances + Bonus + Overtime + Reimbursements
- [ ] Total Deductions = PF + ESI + PT + TDS + LOP + Penalties
- [ ] Net Pay = Gross Pay - Total Deductions
- [ ] Employer PF calculated separately (not in employee net)

#### 4.3 Performance Metrics
- [ ] Rating distribution histogram correct
- [ ] Peer average calculated from same cycle
- [ ] Goal completion % reflects achieved vs total goals
- [ ] Top performers sorted by rating DESC

#### 4.4 Turnover Calculations
- [ ] Attrition Rate = (Employees Left / Avg Headcount) * 100
- [ ] Recent Hires = employees hired in last 90 days
- [ ] Avg Tenure = (sum of tenure days) / employee count

---

### 5. Cache & Performance Tests

#### 5.1 Response Time
```bash
# Measure latency for heavy queries
time curl -X GET "http://localhost:3000/reports/dashboard" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -w "\nTotal time: %{time_total}s\n"

# Expected: < 2s for dashboard (with in-memory cache)
```

#### 5.2 Cache Hit Validation
- [ ] First dashboard call takes ~500-800ms (cold cache)
- [ ] Subsequent same call within cache TTL takes <100ms
- [ ] Cache invalidates on new attendance/payroll records

#### 5.3 Pagination (if implemented)
```bash
curl -X GET "http://localhost:3000/reports/attendance?limit=50&offset=0" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: { data: [...], total: 450, hasMore: true }
```

---

### 6. Error Handling Tests

#### 6.1 Unauthorized Access
```bash
# No token
curl -X GET http://localhost:3000/reports/dashboard

# Expected: 401 Unauthorized

# Invalid token
curl -X GET http://localhost:3000/reports/dashboard \
  -H "Authorization: Bearer invalid.token.here"

# Expected: 401 Unauthorized
```

#### 6.2 Insufficient Permissions
```bash
# Employee trying to access admin-only endpoint
curl -X GET http://localhost:3000/reports/dashboard \
  -H "Authorization: Bearer {EMPLOYEE_JWT_TOKEN}"

# Expected: 200 OK but with scoped data (self only)
# OR 403 Forbidden if endpoint is strictly admin-only
```

#### 6.3 Invalid Date Formats
```bash
curl -X GET "http://localhost:3000/reports/attendance?from=invalid" \
  -H "Authorization: Bearer {JWT_TOKEN}"

# Expected: 400 Bad Request with error message
```

#### 6.4 Non-existent Employee ID
```bash
curl -X GET "http://localhost:3000/reports/attendance?employeeId=999999" \
  -H "Authorization: Bearer {JWT_TOKEN}"

# Expected: 200 OK with empty array (or 404 if stricter validation)
```

---

## Frontend (Next.js) UAT Tests

### 7. Dashboard Rendering Tests

#### 7.1 Load States
- [ ] Skeleton loaders appear while data loading
- [ ] Charts render correctly with mock data structure
- [ ] All 4 chart components (Attendance, Payroll, Growth, Performance) render
- [ ] Summary cards display correct values from API

#### 7.2 Filter Controls
- [ ] Month selector works (changes data)
- [ ] Department multi-select works
- [ ] Employee autocomplete works (if visible for HR/Admin)
- [ ] Role-based filter visibility (Employee doesn't see all filters)

#### 7.3 Chart Interactions
- [ ] AttendanceTrendChart displays line chart with monthly trend
- [ ] PayrollCostChart displays bar chart with dept breakdown
- [ ] EmployeeGrowthChart displays area chart over time
- [ ] PerformanceDistributionChart displays histogram/distribution

#### 7.4 Table Navigation
- [ ] Top Performers table loads and shows 5-10 records
- [ ] Recent Hires table shows new employees
- [ ] Attendance Breakdown table shows dept summary
- [ ] All tables support sorting/column selection

#### 7.5 Error States
- [ ] API error displays user-friendly message
- [ ] Timeout shows retry button
- [ ] Unauthorized access redirects to login

#### 7.6 Responsive Design
- [ ] Dashboard works on mobile (stacked layout)
- [ ] Tablet layout optimized (2-column charts)
- [ ] Desktop layout (4-column grid) proper

---

## Manual Test Execution Steps

### Setup Phase
1. **Create test environment:**
   ```bash
   # Ensure API running on localhost:3000
   cd api && npm run start:dev
   
   # Ensure Frontend running on localhost:3001
   cd web && npm run dev
   ```

2. **Create test users in database:**
   - Admin user (role: ADMIN)
   - HR user (role: HR)
   - Manager user (role: MANAGER) with 5-10 team members
   - Employee user (role: EMPLOYEE)

3. **Generate sample data:**
   - 20-30 employees with varied departments
   - 3 months of attendance records (present/absent/leave mix)
   - 3 months of payroll entries with varied structures
   - 5-10 performance reviews across employees
   - 2-3 recent hires in last 60 days
   - Track salary/benefits variance by dept

### Execution Phase
1. **Run API smoke tests** (curl commands above)
2. **Test role-scoped access** for each role
3. **Validate filter combinations** work end-to-end
4. **Check data accuracy** against raw database records
5. **Measure response times** for cache validation
6. **Test error scenarios** (bad dates, no permissions, etc.)
7. **Frontend UAT** via browser (Chrome DevTools for performance)

### Validation Checklist
- [ ] All 8 endpoints return appropriate data for user role
- [ ] Role scoping enforced correctly (no cross-role data leaks)
- [ ] Filter parameters work and correctly narrow results
- [ ] Response times < 2s for complex queries
- [ ] Charts render and display data accurately
- [ ] No console errors in browser DevTools
- [ ] Mobile/tablet/desktop responsive design validated
- [ ] Error messages are user-friendly and actionable

---

## Known Limitations & Future Hardening

### Current Implementation (In-Memory Cache)
✅ Lightweight, fast for prototyping  
⚠️ Data loss on restart  
⚠️ No multi-instance scaling  

### Recommended Production Hardening
1. **Persistent Aggregation Store**
   - Add `ReportsSnapshot` table in Prisma
   - Store monthly pre-computed summaries
   - Fallback to live calculation if snapshot stale

2. **Background Job Queue**
   - BullMQ/RabbitMQ for async aggregation
   - Monthly precompute triggered on payroll run
   - Notification on completion

3. **Real-time Invalidation**
   - Webhook from Attendance/Payroll modules
   - Trigger cache clear when new records inserted
   - Subscribe to database change events (PG LISTEN/NOTIFY)

4. **Rate Limiting**
   - 100 req/min per user
   - 50 req/min for heavy aggregations
   - Exponential backoff on repeated failures

5. **Audit Logging**
   - Log all dashboard access with user/role/filters
   - Track query execution times
   - Alert on anomalies

---

## Testing Notes

- **Timing:** Complete 2-4 hours depending on data volume
- **Data Size:** Test with 50-200 employees for realistic scale
- **Concurrency:** Test multiple simultaneous dashboard loads
- **Failover:** Test cache clear and fallback behavior
