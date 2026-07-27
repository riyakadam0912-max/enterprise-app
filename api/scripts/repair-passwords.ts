#!/usr/bin/env node

/**
 * Password Repair Script
 *
 * This script identifies users with plaintext passwords in the database and
 * converts them to bcrypt hashes. It should be run after the migration:
 * 20260725140000_prepare_password_hashing_repair
 *
 * Usage:
 *   npx ts-node api/scripts/repair-passwords.ts
 *   or
 *   node api/scripts/repair-passwords.js (after compilation)
 *
 * This script:
 * 1. Queries all users from the database
 * 2. Identifies plaintext passwords (not bcrypt hashes starting with $2a$, $2b$, $2x$, $2y$)
 * 3. Hashes them with bcrypt(password, 10)
 * 4. Updates the database with hashed passwords
 * 5. Logs results and statistics
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Regex to detect bcrypt hashes
const BCRYPT_REGEX = /^\$2[aby]\$.{56}$/;

function isBcryptHash(password: string): boolean {
  return BCRYPT_REGEX.test(password);
}

async function main() {
  try {
    console.log('\n=== Password Repair Script ===\n');
    console.log('Scanning database for plaintext passwords...\n');

    // Fetch all users with their passwords
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
      },
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${users.length} total users in the database.\n`);

    const plaintextUsers = users.filter((user) => !isBcryptHash(user.password));

    if (plaintextUsers.length === 0) {
      console.log(
        '✓ No plaintext passwords found. All passwords are already hashed!',
      );
      console.log('Script completed successfully.\n');
      return;
    }

    console.log(
      `⚠ Found ${plaintextUsers.length} users with plaintext passwords:\n`,
    );
    plaintextUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.role})`);
    });
    console.log('');

    // Hash plaintext passwords
    console.log('Hashing plaintext passwords (bcrypt rounds: 10)...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const user of plaintextUsers) {
      try {
        const hashedPassword = await bcrypt.hash(user.password, 10);

        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });

        console.log(`  ✓ Hashed: ${user.email}`);
        successCount++;
      } catch (error) {
        console.error(
          `  ✗ Error hashing password for ${user.email}:`,
          error instanceof Error ? error.message : String(error),
        );
        errorCount++;
      }
    }

    console.log('\n=== Summary ===\n');
    console.log(`Successfully hashed: ${successCount} users`);
    if (errorCount > 0) {
      console.log(`Failed to hash: ${errorCount} users`);
      console.log(
        '⚠ Some passwords could not be hashed. Please review the errors above.',
      );
    } else {
      console.log(
        '✓ All plaintext passwords have been successfully converted to bcrypt hashes!',
      );
    }

    console.log('\nScript completed.\n');
  } catch (error) {
    console.error('Fatal error during password repair:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
