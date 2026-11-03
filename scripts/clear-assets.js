#!/usr/bin/env node

/**
 * Reset / Clear Assets Inventory Script
 * Safely removes all records from dbo.assets and linked relational tables
 */

const fs = require('fs');
const path = require('path');

// Safe .env loader
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const { PrismaClient } = require('../packages/database/generated/client');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('🧹 Clearing Assets Inventory from Database');
  console.log('====================================================\n');

  try {
    const initialCount = await prisma.asset.count();
    console.log(`Current assets in database: ${initialCount}`);

    if (initialCount === 0) {
      console.log('No assets found in database. Nothing to delete.');
      return;
    }

    console.log('Deleting dependent relational records...');
    const deletedPhotos = await prisma.assetPhoto.deleteMany({});
    console.log(`- Deleted ${deletedPhotos.count} asset photos`);

    const deletedDocs = await prisma.assetDocument.deleteMany({});
    console.log(`- Deleted ${deletedDocs.count} asset documents`);

    const deletedAssignments = await prisma.assetAssignment.deleteMany({});
    console.log(`- Deleted ${deletedAssignments.count} asset assignments`);

    const deletedTransfers = await prisma.assetTransfer.deleteMany({});
    console.log(`- Deleted ${deletedTransfers.count} asset transfers`);

    const deletedMaintenance = await prisma.maintenanceRecord.deleteMany({});
    console.log(`- Deleted ${deletedMaintenance.count} maintenance records`);

    const deletedSchedules = await prisma.maintenanceSchedule.deleteMany({});
    console.log(`- Deleted ${deletedSchedules.count} maintenance schedules`);

    const deletedDiscrepancies = await prisma.auditDiscrepancy.deleteMany({});
    console.log(`- Deleted ${deletedDiscrepancies.count} audit discrepancies`);

    const deletedAuditItems = await prisma.auditItem.deleteMany({});
    console.log(`- Deleted ${deletedAuditItems.count} audit items`);

    console.log('Deleting assets...');
    const deletedAssets = await prisma.asset.deleteMany({});

    console.log('\n====================================================');
    console.log(`✓ Successfully cleared ${deletedAssets.count} assets from inventory!`);
    console.log('Database is now clean and ready for Excel import.');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Error clearing assets:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

