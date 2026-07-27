-- ============================================
-- User-Employee Relationship Verification
-- ============================================
-- This script helps identify and fix issues with user-employee relationships

-- 1. Check users without employee records
SELECT 
  u.id as user_id,
  u.email,
  u.name,
  u.role,
  u.employeeId,
  u.isActive
FROM "User" u
WHERE u.employeeId IS NULL 
  AND u.isActive = true
ORDER BY u.createdAt DESC;

-- 2. Check employees without user accounts
SELECT 
  e.id as employee_id,
  e.name,
  e.email,
  e.position,
  e.department
FROM "Employee" e
LEFT JOIN "User" u ON e.id = u.employeeId
WHERE u.id IS NULL
ORDER BY e.createdAt DESC;

-- 3. Check user-employee relationship integrity
SELECT 
  u.id as user_id,
  u.email as user_email,
  u.name as user_name,
  u.role,
  u.employeeId,
  e.id as employee_id,
  e.name as employee_name,
  e.email as employee_email,
  CASE 
    WHEN u.employeeId IS NULL THEN 'NO_EMPLOYEE_LINK'
    WHEN e.id IS NULL THEN 'INVALID_EMPLOYEE_ID'
    WHEN u.email != e.email THEN 'EMAIL_MISMATCH'
    ELSE 'OK'
  END as status
FROM "User" u
LEFT JOIN "Employee" e ON u.employeeId = e.id
WHERE u.isActive = true
ORDER BY 
  CASE 
    WHEN u.employeeId IS NULL THEN 1
    WHEN e.id IS NULL THEN 2
    WHEN u.email != e.email THEN 3
    ELSE 4
  END,
  u.createdAt DESC;

-- ============================================
-- FIX SCRIPTS (Run these after verification)
-- ============================================

-- Option 1: Link existing users to employees by email match
-- CAUTION: Review the matches before running this!
/*
UPDATE "User" u
SET "employeeId" = e.id
FROM "Employee" e
WHERE u.email = e.email
  AND u.employeeId IS NULL
  AND u.isActive = true;
*/

-- Option 2: Create employee records for users without them
-- CAUTION: This creates new employee records!
/*
INSERT INTO "Employee" (
  name,
  email,
  position,
  department,
  status,
  "createdAt",
  "updatedAt"
)
SELECT 
  u.name,
  u.email,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'Administrator'
    WHEN u.role = 'HR' THEN 'HR Manager'
    WHEN u.role = 'MANAGER' THEN 'Manager'
    ELSE 'Employee'
  END as position,
  'General' as department,
  'ACTIVE' as status,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "User" u
WHERE u.employeeId IS NULL
  AND u.isActive = true
  AND NOT EXISTS (
    SELECT 1 FROM "Employee" e WHERE e.email = u.email
  );

-- Then link the newly created employees
UPDATE "User" u
SET "employeeId" = e.id
FROM "Employee" e
WHERE u.email = e.email
  AND u.employeeId IS NULL
  AND u.isActive = true;
*/

-- Option 3: For testing - create a test employee and link to a specific user
/*
-- Replace USER_EMAIL with actual email
INSERT INTO "Employee" (
  name,
  email,
  position,
  department,
  status,
  "createdAt",
  "updatedAt"
)
VALUES (
  'Test Employee',
  'USER_EMAIL',
  'Software Engineer',
  'Engineering',
  'ACTIVE',
  NOW(),
  NOW()
)
RETURNING id;

-- Then update the user with the returned employee ID
UPDATE "User"
SET "employeeId" = (SELECT id FROM "Employee" WHERE email = 'USER_EMAIL')
WHERE email = 'USER_EMAIL';
*/

-- ============================================
-- VERIFICATION AFTER FIX
-- ============================================

-- Run this to verify all active users have employee records
SELECT 
  COUNT(*) as total_active_users,
  COUNT(u.employeeId) as users_with_employee,
  COUNT(*) - COUNT(u.employeeId) as users_without_employee
FROM "User" u
WHERE u.isActive = true;

-- Expected result: users_without_employee should be 0

-- Made with Bob
