#!/usr/bin/env node
/**
 * READ-ONLY Script: Verify employee account exists in production database
 * Do NOT modify database in this script
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyEmployeeAccount() {
  try {
    console.log('='.repeat(60));
    console.log('EMPLOYEE ACCOUNT VERIFICATION');
    console.log('='.repeat(60));
    
    const email = 'riyakadam0912@gmail.com';
    console.log(`\nSearching for user: ${email}\n`);
    
    // Check User exists
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: true,
        organization: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User DOES NOT EXIST in database');
      console.log(`   Email: ${email}`);
      return;
    }

    console.log('✓ User Found');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);

    // Check password hash exists
    if (!user.password) {
      console.log('❌ Password hash: MISSING');
    } else {
      console.log('✓ Password hash: EXISTS (hash not shown for security)');
      const isBcryptHash = user.password.startsWith('$2a$') || 
                          user.password.startsWith('$2b$') || 
                          user.password.startsWith('$2y$');
      if (isBcryptHash) {
        console.log('  Format: bcrypt ✓');
      } else {
        console.log('  Format: UNKNOWN (not bcrypt?)');
      }
    }

    // Check Employee relationship
    if (user.employeeId) {
      console.log(`\n✓ Employee Relationship: EXISTS`);
      console.log(`   Employee ID: ${user.employeeId}`);
      
      if (user.employee) {
        console.log(`   Employee Name: ${user.employee.name}`);
        console.log(`   Department: ${user.employee.department || 'N/A'}`);
        console.log(`   Designation: ${user.employee.designation || 'N/A'}`);
        console.log(`   Organization ID: ${user.employee.organizationId}`);
      }
    } else {
      console.log('\n❌ Employee Relationship: NOT SET (employeeId is null)');
    }

    // Check Organization relationship
    if (user.organizationId) {
      console.log(`\n✓ Organization Relationship: EXISTS`);
      console.log(`   Organization ID: ${user.organizationId}`);
      
      if (user.organization) {
        console.log(`   Organization Name: ${user.organization.name}`);
        console.log(`   Organization Code: ${user.organization.code}`);
        console.log(`   Organization Slug: ${user.organization.slug}`);
      }
    } else {
      console.log('\n❌ Organization Relationship: NOT SET (organizationId is null)');
    }

    // Check Roles and Permissions
    if (user.userRoles && user.userRoles.length > 0) {
      console.log(`\n✓ Roles: EXISTS (${user.userRoles.length} role(s))`);
      
      user.userRoles.forEach((ur, index) => {
        console.log(`\n   Role ${index + 1}: ${ur.role.name}`);
        console.log(`   Description: ${ur.role.description || 'N/A'}`);
        
        if (ur.role.rolePermissions && ur.role.rolePermissions.length > 0) {
          console.log(`   Permissions (${ur.role.rolePermissions.length}):`);
          ur.role.rolePermissions.forEach(rp => {
            console.log(`     - ${rp.permission.key}`);
          });
        } else {
          console.log(`   Permissions: NONE`);
        }
      });
    } else {
      console.log('\n❌ Roles: NOT SET (no user roles assigned)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const checks = {
      'User exists': !!user,
      'Password hash exists': !!user.password,
      'Password is bcrypted': user.password && (
        user.password.startsWith('$2a$') || 
        user.password.startsWith('$2b$') || 
        user.password.startsWith('$2y$')
      ),
      'Employee relationship': !!user.employeeId,
      'Organization relationship': !!user.organizationId,
      'Has roles': user.userRoles && user.userRoles.length > 0,
      'Account active': user.isActive
    };
    
    Object.entries(checks).forEach(([check, result]) => {
      const symbol = result ? '✓' : '❌';
      console.log(`${symbol} ${check}`);
    });
    
    const allChecks = Object.values(checks).every(v => v);
    console.log('\n' + (allChecks ? '✓ ACCOUNT FULLY CONFIGURED' : '⚠ ACCOUNT HAS ISSUES'));
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.code === 'P1000' || error.code === 'P1002') {
      console.error('   Database connection failed. Check DATABASE_URL is set correctly.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyEmployeeAccount();
