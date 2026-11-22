#!/usr/bin/env node

/**
 * Automated Verified Audit Script
 * 
 * Creates an Audit Plan, a single comprehensive Audit Session, and records all
 * active assets in the database as VERIFIED (scanned and matched in their expected locations).
 * Both the session and plan are marked as COMPLETED.
 * 
 * Usage:
 *   npm run db:auto-audit
 *   npm run db:auto-audit -- --name "Factory Full Audit Q4"
 *   node scripts/auto-audit-verified.js
 */

const fs = require('fs');
const path = require('path');

// ── 1. Load .env Configuration ──────────────────────────────────────────────
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../apps/api/.env'),
  path.resolve(__dirname, '../api/.env'),
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

const now = new Date();
const timestampStr = now.toISOString().replace('T', ' ').slice(0, 16);
const planName = (
  getArg('--name', '-n') ||
  `Full Verified Audit - ${timestampStr}`
).trim();

// ── 3. Main Audit Execution Routine ────────────────────────────────────────
async function main() {
  console.log('========================================================');
  console.log('📋 Automated Verified Audit Generator');
  console.log('========================================================');
  console.log(`Plan Name:   "${planName}"`);
  console.log('Structure:   Single Session (All Assets)');
  console.log('Status:      COMPLETED');
  console.log('Item Status: VERIFIED (100% matched, 0 discrepancies)\n');

  // Load Prisma Client
  let PrismaClient;
  try {
    PrismaClient = require('../packages/database/generated/client').PrismaClient;
  } catch {
    try {
      PrismaClient = require('@prisma/client').PrismaClient;
    } catch {
      PrismaClient = require('./database/generated/client').PrismaClient;
    }
  }

  const prisma = new PrismaClient();

  try {
    // 1. Resolve an Admin / Auditor User
    console.log('🔍 Resolving auditor account...');
    let user = await prisma.user.findFirst({
      where: {
        role: { in: ['SUPER_ADMIN', 'ASSET_MANAGER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!user) {
      user = await prisma.user.findFirst({ where: { isActive: true } });
    }

    if (!user) {
      throw new Error(
        'No active user found in the database. Please run "npm run create-admin" first.',
      );
    }
    console.log(`✓ Auditor assigned: ${user.name} (${user.email}) [ID: ${user.id}]`);

    // 2. Fetch all active assets
    console.log('📦 Fetching all active assets from database...');
    const assets = await prisma.asset.findMany({
      where: { isActive: true },
      select: {
        id: true,
        assetCode: true,
        name: true,
        locationId: true,
      },
      orderBy: { assetCode: 'asc' },
    });

    if (assets.length === 0) {
      console.warn('⚠️ No active assets found in database! Creating plan with 0 items.');
    } else {
      console.log(`✓ Found ${assets.length.toLocaleString()} active assets to audit.`);
    }

    // 3. Create the Audit Plan (COMPLETED)
    console.log('\n📝 Creating Audit Plan...');
    const auditPlan = await prisma.auditPlan.create({
      data: {
        name: planName,
        description: 'Comprehensive audit generated with all assets verified in expected locations.',
        type: 'ADHOC',
        status: 'COMPLETED',
        scopeType: 'ALL',
        scopeIds: '[]',
        scheduledDate: now,
        createdById: user.id,
      },
    });
    console.log(`✓ Audit Plan created successfully! (ID: ${auditPlan.id})`);

    // 4. Create the single comprehensive Audit Session (COMPLETED)
    console.log('⏱️  Creating Audit Session...');
    const startTime = new Date(now.getTime() - 3600000); // 1 hour ago
    const auditSession = await prisma.auditSession.create({
      data: {
        planId: auditPlan.id,
        auditorId: user.id,
        locationId: null, // Covers all locations
        status: 'COMPLETED',
        startedAt: startTime,
        submittedAt: now,
        reviewedAt: now,
        reviewedById: user.id,
        notes: 'Automated verified audit session. All factory assets confirmed present and in good condition.',
      },
    });
    console.log(`✓ Audit Session created successfully! (ID: ${auditSession.id})`);

    // 5. Populate all AuditItems with status = 'VERIFIED'
    if (assets.length > 0) {
      console.log(`\n🏷️  Recording ${assets.length.toLocaleString()} items as VERIFIED...`);

      // Batch in chunks of 200 to safely stay under MSSQL parameter limits (2,100 parameters)
      const BATCH_SIZE = 200;
      let insertedCount = 0;

      for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const chunk = assets.slice(i, i + BATCH_SIZE);
        const records = chunk.map((asset) => ({
          sessionId: auditSession.id,
          assetId: asset.id,
          expectedLocationId: asset.locationId || null,
          foundLocationId: asset.locationId || null,
          status: 'VERIFIED',
          condition: 'Good',
          scannedAt: now,
          notes: 'Auto-verified in designated station/location',
        }));

        await prisma.auditItem.createMany({
          data: records,
        });

        insertedCount += chunk.length;
        process.stdout.write(`   Progress: ${insertedCount.toLocaleString()} / ${assets.length.toLocaleString()} items recorded...\r`);
      }
      console.log(`\n✓ All ${assets.length.toLocaleString()} assets successfully recorded as VERIFIED!`);
    }

    console.log('\n========================================================');
    console.log('🎉 Audit Generation Completed Successfully!');
    console.log('========================================================');
    console.log(`Audit Plan ID:   ${auditPlan.id}`);
    console.log(`Plan Name:       ${auditPlan.name}`);
    console.log(`Plan Status:     ${auditPlan.status}`);
    console.log(`Session ID:      ${auditSession.id}`);
    console.log(`Total Assets:    ${assets.length.toLocaleString()}`);
    console.log(`Verified Items:  ${assets.length.toLocaleString()} (100%)`);
    console.log(`Missing Items:   0 (0%)`);
    console.log(`Discrepancies:   0`);
    console.log('========================================================');
    console.log(`👉 View in Web Portal: /audits/${auditPlan.id}\n`);

  } catch (err) {
    console.error('\n❌ Error generating audit:', err.message);
    if (err.message.includes('Can\'t reach database server')) {
      console.error('👉 Make sure SQL Server is running or check DATABASE_URL in .env');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
