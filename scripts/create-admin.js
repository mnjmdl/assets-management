#!/usr/bin/env node

/**
 * Enterprise Admin Provisioning Script
 * Creates or updates the default Super Admin user in the database.
 * 
 * Usage:
 *   npm run create-admin
 *   npm run create-admin -- --email myadmin@crystal-martin.com --password SecretPass123! --name "Admin Name"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 1. Load .env Configuration ──────────────────────────────────────────────
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../apps/api/.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

// ── 2. Parse Command Line Arguments ────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, shortFlag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || args[i] === shortFlag) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].split('=')[1];
    }
  }
  return null;
}

const email = (
  getArg('--email', '-e') ||
  process.env.ADMIN_EMAIL ||
  'admin@assetmgmt.com'
).toLowerCase().trim();

const password = (
  getArg('--password', '-p') ||
  process.env.ADMIN_PASSWORD ||
  'Password123!'
).trim();

const name = (
  getArg('--name', '-n') ||
  process.env.ADMIN_NAME ||
  'System Administrator'
).trim();

const role = (
  getArg('--role', '-r') ||
  process.env.ADMIN_ROLE ||
  'SUPER_ADMIN'
).trim();

// ── 3. Hash Password (Compatible with NestJS Auth bcrypt.util) ─────────────
async function hashPassword(plainText) {
  try {
    const bcrypt = require('bcrypt');
    if (typeof bcrypt.hash === 'function') {
      return await bcrypt.hash(plainText, 10);
    }
  } catch {}

  // Scrypt fallback compatible with apps/api/src/common/utils/bcrypt.util.ts
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

// ── 4. Main Provisioning Routine ───────────────────────────────────────────
async function main() {
  console.log('========================================================');
  console.log('👤 Provisioning Default Admin User');
  console.log('========================================================\n');

  const { PrismaClient } = require('../packages/database/generated/client');
  const prisma = new PrismaClient();

  try {
    const passwordHash = await hashPassword(password);

    console.log(`Searching for existing user with email: ${email}...`);
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let user;
    if (existingUser) {
      console.log(`Found existing user (ID: ${existingUser.id}). Updating password & elevating role...`);
      user = await prisma.user.update({
        where: { email },
        data: {
          name,
          passwordHash,
          role,
          isActive: true,
        },
      });
      console.log('✅ Admin user credentials updated successfully.');
    } else {
      console.log(`Creating new ${role} user...`);
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          isActive: true,
          employeeId: 'ADM-001',
        },
      });
      console.log('✅ New Admin user created successfully.');
    }

    console.log('\n========================================================');
    console.log('📋 Default Admin Account Ready:');
    console.log('========================================================');
    console.log(`ID:       ${user.id}`);
    console.log(`Name:     ${user.name}`);
    console.log(`Email:    ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${user.role}`);
    console.log(`Active:   ${user.isActive}`);
    console.log('========================================================');
    console.log('👉 You can now sign in at: /login\n');
  } catch (err) {
    console.error('\n❌ Error provisioning admin user:', err.message);
    if (err.message.includes('Can\'t reach database server')) {
      console.error('👉 Ensure SQL Server is running at localhost:1433 or check DATABASE_URL in .env');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

