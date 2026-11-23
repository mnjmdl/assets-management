#!/usr/bin/env node

/**
 * Bulk Mark Missing Assets from Excel
 * 
 * Reads an Excel file containing lost/missing assets (e.g. "Lost Assets List.xlsx"),
 * matches the assets against the database by SAP Asset Code (sapAssetCode) or
 * physical Tag Code (assetCode), and updates the corresponding AuditItem records
 * in the target audit plan/session to MISSING while generating AuditDiscrepancy records.
 * 
 * Usage:
 *   npm run db:mark-missing
 *   npm run db:mark-missing -- --file "./Lost Assets List.xlsx"
 *   npm run db:mark-missing -- --plan <planId>
 *   npm run db:mark-missing -- --session <sessionId>
 *   npm run db:mark-missing -- --dry-run
 *   node scripts/mark-missing-from-excel.js --help
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

// ── 2. Safe Dependency Loaders ──────────────────────────────────────────────
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (e1) {
  try {
    const excelPath = require.resolve('exceljs', {
      paths: [path.resolve(__dirname, '../apps/api'), path.resolve(__dirname, '..')],
    });
    ExcelJS = require(excelPath);
  } catch (e2) {
    console.error('❌ Error: exceljs is required. Run "npm install" first.');
    process.exit(1);
  }
}

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

// ── 3. Parse Command Line Arguments ────────────────────────────────────────
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

const hasFlag = (flag) => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Usage: node scripts/mark-missing-from-excel.js [options]

Options:
  --file, -f <path>       Path to Excel file (default: "./Lost Assets List.xlsx")
  --plan, -p <id>         Target Audit Plan ID (default: latest audit plan)
  --session, -s <id>      Target Audit Session ID (default: all sessions in target plan)
  --notes, -n <text>      Notes to record on item and discrepancy
                          (default: "Flagged as MISSING per Lost Assets List.xlsx")
  --batch-size, -b <num>  Chunk size for database operations (default: 100)
  --sheet <name_or_idx>   Worksheet name or 1-based index (default: first worksheet)
  --dry-run               Simulate and report changes without modifying the database
  --help, -h              Show this help message
`);
  process.exit(0);
}

const defaultFilePath = path.resolve(__dirname, '../Lost Assets List.xlsx');
const customFilePath = getArg('--file', '-f');
const filePath = customFilePath
  ? path.resolve(process.cwd(), customFilePath)
  : defaultFilePath;

const planIdArg = getArg('--plan', '-p');
const sessionIdArg = getArg('--session', '-s');
const notesArg =
  getArg('--notes', '-n') || 'Flagged as MISSING per Lost Assets List.xlsx';
const batchSize = Math.max(10, parseInt(getArg('--batch-size', '-b') || '100', 10));
const sheetArg = getArg('--sheet');
const isDryRun = hasFlag('--dry-run');

// ── 4. Main Execution Routine ───────────────────────────────────────────────
async function main() {
  console.log('========================================================');
  console.log('📑 Bulk Mark Missing Assets from Excel');
  console.log('========================================================');
  console.log(`Excel File:   ${filePath}`);
  console.log(`Dry Run:      ${isDryRun ? 'YES (No database changes will be saved)' : 'NO (Live database updates)'}`);
  console.log(`Batch Size:   ${batchSize}`);
  console.log(`Audit Notes:  "${notesArg}"\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Excel file not found at: ${filePath}`);
    console.error('👉 Use --file <path> to specify the location of your Excel spreadsheet.');
    process.exit(1);
  }

  // 1. Read Excel file and extract asset codes
  console.log('📖 Reading Excel file with ExcelJS...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let worksheet;
  if (sheetArg) {
    worksheet = isNaN(sheetArg)
      ? workbook.getWorksheet(sheetArg)
      : workbook.worksheets[parseInt(sheetArg, 10) - 1];
    if (!worksheet) {
      console.error(`❌ Error: Sheet "${sheetArg}" not found in workbook.`);
      process.exit(1);
    }
  } else {
    worksheet = workbook.worksheets[0];
  }

  console.log(`✓ Loaded worksheet: "${worksheet.name}" (${worksheet.rowCount} total rows)`);

  // Detect header and asset column
  let headerRowIndex = -1;
  let assetColIndex = 3; // Default to Column 3 (C) per Lost Assets List.xlsx

  const headerCandidates = [
    'asset',
    'asset code',
    'asset no',
    'asset no:',
    'sap asset code',
    'sap asset',
    'sap code',
    'tagging number',
    'tag',
    'tag code',
  ];

  // Scan first 10 rows for a matching header
  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    let found = false;
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim().toLowerCase();
      if (headerCandidates.includes(val)) {
        headerRowIndex = r;
        assetColIndex = colNumber;
        found = true;
      }
    });
    if (found) break;
  }

  if (headerRowIndex !== -1) {
    console.log(`✓ Detected header at Row ${headerRowIndex}, Asset Code at Column ${assetColIndex}`);
  } else {
    headerRowIndex = 2; // fallback to row 2
    console.log(`ℹ️  No explicit header match found in first 10 rows. Using Row ${headerRowIndex} header, Column ${assetColIndex} ('Asset')`);
  }

  const rawCodes = [];
  const uniqueCodeSet = new Set();

  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const cellValue = row.getCell(assetColIndex).value;
    if (cellValue !== null && cellValue !== undefined) {
      let codeStr = '';
      if (typeof cellValue === 'object') {
        codeStr = String(cellValue.text || cellValue.result || '').trim();
      } else {
        codeStr = String(cellValue).trim();
      }

      // If scientific notation or formatted number string
      if (codeStr && codeStr !== 'undefined' && codeStr !== 'null') {
        rawCodes.push(codeStr);
        uniqueCodeSet.add(codeStr);
      }
    }
  }

  const excelCodes = Array.from(uniqueCodeSet);
  console.log(`✓ Extracted ${rawCodes.length.toLocaleString()} total entries (${excelCodes.length.toLocaleString()} unique codes) from Excel.\n`);

  if (excelCodes.length === 0) {
    console.warn('⚠️ No asset codes found in spreadsheet. Exiting.');
    process.exit(0);
  }

  // 2. Initialize Prisma & resolve target Audit Plan / Session
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Resolving target Audit Plan and Session...');
    let targetPlan = null;
    let targetSessions = [];

    if (sessionIdArg) {
      const session = await prisma.auditSession.findUnique({
        where: { id: sessionIdArg },
        include: { plan: true },
      });
      if (!session) {
        throw new Error(`Audit Session with ID "${sessionIdArg}" not found.`);
      }
      targetPlan = session.plan;
      targetSessions = [session];
      console.log(`✓ Selected specific Audit Session: [ID: ${session.id}] (Status: ${session.status})`);
      console.log(`  Belongs to Plan: "${targetPlan.name}" [ID: ${targetPlan.id}]`);
    } else if (planIdArg) {
      targetPlan = await prisma.auditPlan.findUnique({
        where: { id: planIdArg },
        include: { sessions: true },
      });
      if (!targetPlan) {
        throw new Error(`Audit Plan with ID "${planIdArg}" not found.`);
      }
      targetSessions = targetPlan.sessions;
      console.log(`✓ Selected specific Audit Plan: "${targetPlan.name}" [ID: ${targetPlan.id}] (Status: ${targetPlan.status})`);
      console.log(`  Contains ${targetSessions.length} session(s).`);
    } else {
      // Auto-detect the latest audit plan
      targetPlan = await prisma.auditPlan.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { sessions: true },
      });

      if (!targetPlan) {
        throw new Error(
          'No Audit Plan found in database. Create an audit plan first or run "npm run db:auto-audit".'
        );
      }
      targetSessions = targetPlan.sessions;
      console.log(`✓ Auto-detected latest Audit Plan: "${targetPlan.name}" [ID: ${targetPlan.id}] (Status: ${targetPlan.status})`);
      console.log(`  Contains ${targetSessions.length} session(s).`);
    }

    if (targetSessions.length === 0) {
      throw new Error(`The selected Audit Plan "${targetPlan.name}" contains 0 audit sessions.`);
    }

    const sessionIds = targetSessions.map((s) => s.id);

    // 3. Match Excel codes to Assets in Database
    console.log('\n🔎 Querying database for assets matching Excel codes...');
    const matchedAssets = [];
    const matchedAssetCodeSet = new Set();
    const matchedSapCodeSet = new Set();

    // Query in batches of batchSize to avoid SQL parameter limit
    for (let i = 0; i < excelCodes.length; i += batchSize) {
      const chunk = excelCodes.slice(i, i + batchSize);
      const assets = await prisma.asset.findMany({
        where: {
          OR: [
            { sapAssetCode: { in: chunk } },
            { assetCode: { in: chunk } },
          ],
        },
        select: {
          id: true,
          assetCode: true,
          sapAssetCode: true,
          name: true,
          isActive: true,
        },
      });

      for (const asset of assets) {
        matchedAssets.push(asset);
        if (asset.assetCode) matchedAssetCodeSet.add(asset.assetCode);
        if (asset.sapAssetCode) matchedSapCodeSet.add(asset.sapAssetCode);
      }
    }

    const unmatchedCodes = excelCodes.filter(
      (code) => !matchedAssetCodeSet.has(code) && !matchedSapCodeSet.has(code)
    );

    console.log(`✓ Found ${matchedAssets.length.toLocaleString()} matching asset records in database.`);
    if (unmatchedCodes.length > 0) {
      console.log(`ℹ️  ${unmatchedCodes.length.toLocaleString()} codes from Excel were not found in the database.`);
      if (unmatchedCodes.length <= 10) {
        console.log(`   Sample unmatched: ${unmatchedCodes.join(', ')}`);
      } else {
        console.log(`   Sample unmatched: ${unmatchedCodes.slice(0, 10).join(', ')} ... (+${unmatchedCodes.length - 10} more)`);
      }
    }

    if (matchedAssets.length === 0) {
      console.warn('⚠️ None of the Excel asset codes matched any asset in the database. Nothing to update.');
      process.exit(0);
    }

    // 4. Fetch corresponding AuditItem records from the target session(s)
    console.log('\n📋 Fetching checklist items for target audit session(s)...');
    const matchedAssetIds = matchedAssets.map((a) => a.id);
    const auditItems = [];

    for (let i = 0; i < matchedAssetIds.length; i += batchSize) {
      const chunk = matchedAssetIds.slice(i, i + batchSize);
      const items = await prisma.auditItem.findMany({
        where: {
          sessionId: { in: sessionIds },
          assetId: { in: chunk },
        },
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              sapAssetCode: true,
              name: true,
            },
          },
        },
      });
      auditItems.push(...items);
    }

    console.log(`✓ Found ${auditItems.length.toLocaleString()} audit items matching in target session checklist(s).`);

    const assetsNotInAudit = matchedAssets.length - auditItems.length;
    if (assetsNotInAudit > 0) {
      console.log(`ℹ️  ${assetsNotInAudit.toLocaleString()} matched assets exist in DB but are not part of the target audit session(s).`);
    }

    // Categorize items
    const alreadyMissing = auditItems.filter((item) => item.status === 'MISSING');
    const itemsToUpdate = auditItems.filter((item) => item.status !== 'MISSING');

    console.log(`   • Already marked MISSING:  ${alreadyMissing.length.toLocaleString()}`);
    console.log(`   • To be updated to MISSING: ${itemsToUpdate.length.toLocaleString()}`);

    if (itemsToUpdate.length === 0 && alreadyMissing.length > 0) {
      console.log('\n✓ All matched audit items are already marked as MISSING. No database updates required.');
    } else if (itemsToUpdate.length === 0) {
      console.warn('\n⚠️ No matching audit items found to update in the selected audit session(s).');
      process.exit(0);
    }

    // 5. Apply Updates (or Dry Run)
    if (isDryRun) {
      console.log('\n🔍 [DRY RUN] Simulation mode active. No records were modified.');
    } else if (itemsToUpdate.length > 0) {
      console.log(`\n⚙️  Updating ${itemsToUpdate.length.toLocaleString()} audit items to MISSING...`);

      const now = new Date();
      let updatedCount = 0;
      let discrepancyCreatedCount = 0;

      // Update AuditItems in chunks
      for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
        const chunk = itemsToUpdate.slice(i, i + batchSize);
        const chunkIds = chunk.map((item) => item.id);

        // Update AuditItem status to MISSING
        await prisma.auditItem.updateMany({
          where: { id: { in: chunkIds } },
          data: {
            status: 'MISSING',
            notes: notesArg,
          },
        });

        // Resolve existing discrepancies for these items
        const existingDiscrepancies = await prisma.auditDiscrepancy.findMany({
          where: { auditItemId: { in: chunkIds } },
          select: { auditItemId: true },
        });
        const existingDiscrepancySet = new Set(
          existingDiscrepancies.map((d) => d.auditItemId)
        );

        // Prepare new discrepancy records for items that do not have one
        const discrepanciesToCreate = [];
        for (const item of chunk) {
          if (!existingDiscrepancySet.has(item.id)) {
            const assetIdent =
              item.asset?.sapAssetCode || item.asset?.assetCode || item.assetId;
            discrepanciesToCreate.push({
              sessionId: item.sessionId,
              assetId: item.assetId,
              auditItemId: item.id,
              discrepancyType: 'MISSING',
              description: `Asset "${assetIdent}" flagged as MISSING per Excel import (${notesArg})`,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        if (discrepanciesToCreate.length > 0) {
          await prisma.auditDiscrepancy.createMany({
            data: discrepanciesToCreate,
          });
          discrepancyCreatedCount += discrepanciesToCreate.length;
        }

        updatedCount += chunk.length;
        process.stdout.write(
          `   Progress: ${updatedCount.toLocaleString()} / ${itemsToUpdate.length.toLocaleString()} items updated...\r`
        );
      }

      console.log(`\n✓ Successfully marked ${updatedCount.toLocaleString()} items as MISSING.`);
      console.log(`✓ Created ${discrepancyCreatedCount.toLocaleString()} new AuditDiscrepancy records.`);
    }

    // 6. Summary Report
    console.log('\n========================================================');
    console.log('📊 Summary Execution Report');
    console.log('========================================================');
    console.log(`Audit Plan:          ${targetPlan.name} [ID: ${targetPlan.id}]`);
    console.log(`Sessions Targeted:   ${targetSessions.length}`);
    console.log(`Total Excel Codes:   ${excelCodes.length.toLocaleString()}`);
    console.log(`Assets Matched in DB:${matchedAssets.length.toLocaleString()}`);
    console.log(`Codes Not in DB:     ${unmatchedCodes.length.toLocaleString()}`);
    console.log(`Items in Audit:      ${auditItems.length.toLocaleString()}`);
    console.log(`Newly Marked MISSING:${isDryRun ? `${itemsToUpdate.length.toLocaleString()} (Dry Run)` : itemsToUpdate.length.toLocaleString()}`);
    console.log(`Already Were MISSING:${alreadyMissing.length.toLocaleString()}`);
    console.log('========================================================');
    console.log(`👉 View updated audit in Web Portal: /audits/${targetPlan.id}\n`);

  } catch (err) {
    console.error('\n❌ Execution error:', err.message);
    if (err.message && err.message.includes("Can't reach database server")) {
      console.error('👉 Make sure SQL Server is running or verify DATABASE_URL in .env');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
