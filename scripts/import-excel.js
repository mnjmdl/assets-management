#!/usr/bin/env node

/**
 * Bulk Excel Importer for Fixed Asset List
 * File: FA List ABL 2026.xlsx
 *
 * Mappings:
 * - Col 2 (Asset Class): Stored in category / AssetCategory.code
 * - Col 3 (Category): Stored in AssetCategory.name
 * - Col 4 (Asset No:): sapAssetCode (SAP ERP identifier)
 * - Col 5 (Tagging Number): assetCode (Physical tag & QR identifier)
 * - Col 6 (Asset Description): name & description
 * - Col 7 (Capitalized Date): purchaseDate
 * - Col 8 (Asset Cost BDT'K): purchaseCost & currentValue (Decimal in BDT thousands)
 */

const fs = require('fs');
const path = require('path');

// 1. Safe .env loader without third-party dependencies
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

// 2. Safe ExcelJS loader with monorepo fallback
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

const { PrismaClient, Prisma } = require('../packages/database/generated/client');
const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

async function main() {
  const filePath = process.argv[2] || path.resolve(__dirname, '../FA List ABL 2026.xlsx');

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: Excel file not found at: ${filePath}`);
    console.log('Usage: node scripts/import-excel.js [path/to/file.xlsx]\n');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('📊 Enterprise Asset Excel Importer');
  console.log('====================================================');
  console.log(`Source File: ${filePath}`);
  console.log(`Database:    ${process.env.DATABASE_URL ? 'Configured in .env' : 'Missing DATABASE_URL'}`);
  console.log('====================================================\n');

  const startTime = Date.now();

  try {
    // 1. Ensure Default Admin User exists for createdById foreign key
    console.log('Step 1: Checking default system user...');
    let admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (!admin) {
      console.log('Creating default system admin user (system.admin@assets.com)...');
      admin = await prisma.user.create({
        data: {
          email: 'system.admin@assets.com',
          name: 'System Admin',
          role: 'SUPER_ADMIN',
          passwordHash: '$2a$12$e8F0sM8y07d6K4rM2/8V6OQ4xP.W4O8j1N2G.7p8M8Q8r8M8j1N2G', // Default initial hash
        },
      });
    }
    console.log(`✓ System User: ${admin.name} (${admin.id})\n`);

    // 2. Ensure Root Company Location exists
    console.log('Step 2: Checking root location hierarchy...');
    let rootCompany = await prisma.location.findFirst({
      where: { type: 'COMPANY' },
    });

    if (!rootCompany) {
      console.log('Creating root company location: ABL Global...');
      rootCompany = await prisma.location.create({
        data: {
          name: 'Apex ABL Manufacturing',
          code: 'ABL-CORP',
          type: 'COMPANY',
          qrCode: 'LOC:ABL-CORP',
          description: 'Root manufacturing enterprise location',
        },
      });
    }
    console.log(`✓ Root Company: ${rootCompany.name} (${rootCompany.code})\n`);

    // 3. Read Excel workbook
    console.log('Step 3: Reading Excel workbook...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets[0];
    console.log(`✓ Loaded sheet "${sheet.name}" with ${sheet.rowCount} rows\n`);

    // 4. Dynamically detect header row and column positions
    console.log('Step 4: Detecting schema mapping...');
    let headerRowIndex = 3;
    let assetClassCol = 2;
    let categoryCol = 3;
    let sapCodeCol = 4;
    let tagCodeCol = 5;
    let descCol = 6;
    let capDateCol = 7;
    let costCol = 8;

    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let foundMarkers = 0;
      row.eachCell((cell, colNumber) => {
        const text = String(cell.value || '').trim().toLowerCase();
        if (text.includes('asset class')) {
          assetClassCol = colNumber;
          foundMarkers++;
        } else if (text === 'category' || text.includes('category')) {
          categoryCol = colNumber;
          foundMarkers++;
        } else if (text.includes('asset no') || text.includes('sap')) {
          sapCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('tagging') || text.includes('tag number')) {
          tagCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('description') || text.includes('asset desc')) {
          descCol = colNumber;
          foundMarkers++;
        } else if (text.includes('capitalized') || text.includes('purchase date')) {
          capDateCol = colNumber;
          foundMarkers++;
        } else if (text.includes('cost') || text.includes('bdt')) {
          costCol = colNumber;
          foundMarkers++;
        }
      });
      if (foundMarkers >= 3) {
        headerRowIndex = r;
        break;
      }
    }
    console.log(`✓ Header detected on row ${headerRowIndex} (Data starts at row ${headerRowIndex + 1})\n`);

    // 5. Fetch existing categories and upload ANY new categories FIRST
    console.log('Step 5: Verifying Categories (Upload New Categories First)...');
    const existingDbCategories = await prisma.assetCategory.findMany();
    const categoryByCode = new Map();
    const categoryByName = new Map();

    for (const cat of existingDbCategories) {
      if (cat.code) categoryByCode.set(cat.code.trim().toUpperCase(), cat.id);
      if (cat.name) categoryByName.set(cat.name.trim().toLowerCase(), cat.id);
    }
    console.log(`Found ${existingDbCategories.length} existing categories in database.`);

    // Discover distinct categories in sheet
    const excelCategories = new Map();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawClass = row.getCell(assetClassCol).value;
      const rawCatName = row.getCell(categoryCol).value;

      const assetClass = rawClass ? String(rawClass).trim() : '';
      const categoryName = rawCatName
        ? String(rawCatName).trim()
        : assetClass
        ? `Class ${assetClass}`
        : 'General Assets';
      const catCode = assetClass
        ? `CAT-${assetClass}`
        : `CAT-${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

      if (!excelCategories.has(catCode)) {
        excelCategories.set(catCode, {
          code: catCode,
          name: categoryName,
          description: assetClass ? `Asset Class ${assetClass} - ${categoryName}` : categoryName,
        });
      }
    });

    // Check which categories are new and upload them first
    const categoryIdMap = new Map();
    const newlyCreatedCategories = [];

    for (const [code, catInfo] of excelCategories.entries()) {
      const codeKey = code.toUpperCase();
      const nameKey = catInfo.name.toLowerCase();

      const existingId = categoryByCode.get(codeKey) || categoryByName.get(nameKey);

      if (existingId) {
        categoryIdMap.set(code, existingId);
      } else {
        // Upload new category FIRST to database
        let uniqueCode = catInfo.code;
        let suffix = 1;
        while (categoryByCode.has(uniqueCode.toUpperCase())) {
          uniqueCode = `${catInfo.code}_${suffix++}`;
        }

        console.log(`  + New category found in Excel: "${catInfo.name}" (${uniqueCode}) -> Uploading category first...`);
        const newDbCat = await prisma.assetCategory.create({
          data: {
            name: catInfo.name,
            code: uniqueCode,
            description: catInfo.description,
            isActive: true,
          },
        });

        categoryByCode.set(newDbCat.code.toUpperCase(), newDbCat.id);
        categoryByName.set(newDbCat.name.toLowerCase(), newDbCat.id);
        categoryIdMap.set(code, newDbCat.id);
        newlyCreatedCategories.push(newDbCat);
      }
    }

    if (newlyCreatedCategories.length > 0) {
      console.log(`✓ Uploaded ${newlyCreatedCategories.length} new categories to database first.\n`);
    } else {
      console.log(`✓ All ${categoryIdMap.size} categories already exist in database (no new categories needed).\n`);
    }

    // 6. Query existing records to enforce "Upload New SAP Code Only"
    console.log('Step 6: Enforcing "New SAP Code Only" filter...');
    const existingAssets = await prisma.asset.findMany({
      select: { assetCode: true, sapAssetCode: true },
    });
    const existingSapCodes = new Set(
      existingAssets
        .map((a) => a.sapAssetCode)
        .filter(Boolean)
        .map((c) => c.trim())
    );
    const existingAssetCodes = new Set(
      existingAssets
        .map((a) => a.assetCode)
        .filter(Boolean)
        .map((c) => c.trim())
    );
    console.log(`Found ${existingAssets.length} existing assets (${existingSapCodes.size} distinct SAP codes) in database.\n`);

    // 7. Parse and filter records (Upload New SAP Code Only)
    console.log('Step 7: Parsing records (Filtering for new SAP codes only)...');
    const assetsToInsert = [];
    let skippedExistingSap = 0;
    let skippedInvalid = 0;
    const seenSapInBatch = new Set();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawAssetNo = row.getCell(sapCodeCol).value;
      if (!rawAssetNo) {
        skippedInvalid++;
        return;
      }

      const sapAssetCode = String(rawAssetNo).trim();
      if (!sapAssetCode) {
        skippedInvalid++;
        return;
      }

      // Check if SAP code already exists in DB or was already encountered in this batch
      if (existingSapCodes.has(sapAssetCode) || seenSapInBatch.has(sapAssetCode)) {
        skippedExistingSap++;
        return; // SKIP: System uploads new SAP code only
      }

      seenSapInBatch.add(sapAssetCode);

      const rawTaggingNumber = row.getCell(tagCodeCol).value;
      let assetCode;
      if (typeof rawTaggingNumber === 'object' && rawTaggingNumber !== null) {
        assetCode = String(rawTaggingNumber.result || `ABL-${sapAssetCode}`).trim();
      } else {
        assetCode = rawTaggingNumber ? String(rawTaggingNumber).trim() : `ABL-${sapAssetCode}`;
      }

      // Ensure uniqueness of assetCode
      if (existingAssetCodes.has(assetCode)) {
        assetCode = `${assetCode}-${sapAssetCode}`;
      }
      existingAssetCodes.add(assetCode);

      const rawClass = row.getCell(assetClassCol).value;
      const rawCatName = row.getCell(categoryCol).value;
      const assetClass = rawClass ? String(rawClass).trim() : '';
      const categoryName = rawCatName
        ? String(rawCatName).trim()
        : assetClass
        ? `Class ${assetClass}`
        : 'General Assets';
      const catCode = assetClass
        ? `CAT-${assetClass}`
        : `CAT-${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const categoryId = categoryIdMap.get(catCode) || null;

      const rawDescription = row.getCell(descCol).value;
      const name = rawDescription ? String(rawDescription).trim() : `Asset ${sapAssetCode}`;
      const description = name;

      const rawCapitalizedDate = row.getCell(capDateCol).value;
      let purchaseDate = null;
      if (rawCapitalizedDate) {
        const d = new Date(rawCapitalizedDate);
        if (!isNaN(d.getTime())) {
          purchaseDate = d;
        }
      }

      const rawCost = row.getCell(costCol).value;
      let costValue = null;
      if (rawCost !== undefined && rawCost !== null) {
        const num = typeof rawCost === 'object' ? Number(rawCost.result) : Number(rawCost);
        if (!isNaN(num)) {
          costValue = new Prisma.Decimal(num);
        }
      }

      assetsToInsert.push({
        assetCode,
        sapAssetCode,
        name,
        description,
        status: 'ACTIVE',
        categoryId,
        locationId: rootCompany.id,
        purchaseDate,
        purchaseCost: costValue,
        currentValue: costValue,
        qrCode: sapAssetCode, // QR code scan data is SAP Code
        createdById: admin.id,
        isActive: true,
      });
    });

    console.log(`✓ Parsed ${assetsToInsert.length} NEW SAP records to upload.`);
    console.log(`  - Skipped existing SAP codes: ${skippedExistingSap}`);
    if (skippedInvalid > 0) {
      console.log(`  - Skipped invalid/empty rows: ${skippedInvalid}`);
    }
    console.log('');

    if (assetsToInsert.length === 0) {
      console.log('✨ All SAP codes in this Excel file already exist in the database.');
      console.log('No new SAP records to upload. Existing inventory is completely up to date.\n');
      return;
    }

    // 7. Bulk Insert in Batches
    console.log(`Step 7: Inserting ${assetsToInsert.length} assets in batches of ${BATCH_SIZE}...`);
    let insertedTotal = 0;

    for (let i = 0; i < assetsToInsert.length; i += BATCH_SIZE) {
      const batch = assetsToInsert.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();

      await prisma.asset.createMany({
        data: batch,
      });

      insertedTotal += batch.length;
      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);
      const progress = ((insertedTotal / assetsToInsert.length) * 100).toFixed(1);

      console.log(
        `  ↳ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${insertedTotal}/${assetsToInsert.length} (${progress}%) in ${batchTime}s`,
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log('🎉 Import Completed Successfully!');
    console.log('====================================================');
    console.log(`Total New Assets Created: ${insertedTotal}`);
    console.log(`Skipped (Existing SAP):   ${skippedExistingSap}`);
    if (skippedInvalid > 0) {
      console.log(`Skipped (Invalid rows):   ${skippedInvalid}`);
    }
    console.log(`Total Categories Mapped:  ${categoryIdMap.size}`);
    console.log(`New Categories Uploaded:  ${newlyCreatedCategories.length}`);
    console.log(`Total Elapsed Time:       ${elapsed} seconds`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Import Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

