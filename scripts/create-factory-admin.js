#!/usr/bin/env node

/**
 * Enterprise Multi-Factory Admin Provisioning Script
 * 
 * Provisions or updates the Super Admin user in the specified factory database(s):
 *   - CMBD:  Crystal Martin Bangladesh (.env.cmbd)
 *   - CETBD: CETBD Enterprise          (.env.cetbd)
 *   - ABL:   Crystal / ABL Group       (.env.abl)
 *   - ALL:   Provisions all 3 companies in sequence
 * 
 * Usage:
 *   npm run db:admin:cmbd
 *   npm run db:admin:cetbd
 *   npm run db:admin:abl
 *   npm run db:admin:all
 * 
 * Custom credentials:
 *   node scripts/create-factory-admin.js cmbd --email admin@cmbd.com --password SecretPass123!
 *   node scripts/create-factory-admin.js all --email admin@assetmgmt.com --password Password123!
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const target = (args.find((a) => !a.startsWith('-')) || 'all').toLowerCase().trim();

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

const customEmail = getArg('--email', '-e');
const customPassword = getArg('--password', '-p');
const customName = getArg('--name', '-n');
const customRole = getArg('--role', '-r') || 'SUPER_ADMIN';

// Factory definitions
const FACTORIES = {
  cmbd: {
    code: 'CMBD',
    name: 'Crystal Martin Bangladesh',
    file: '.env.cmbd',
    defaultEmail: 'admin@assetmgmt.com',
  },
  cetbd: {
    code: 'CETBD',
    name: 'CETBD Enterprise',
    file: '.env.cetbd',
    defaultEmail: 'admin@assetmgmt.com',
  },
  abl: {
    code: 'ABL',
    name: 'Crystal / ABL Group',
    file: '.env.abl',
    defaultEmail: 'admin@assetmgmt.com',
  },
};

// Simple .env parser
function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[trimmed.slice(0, eqIdx).trim()] = val;
      }
    }
  } catch (err) {
    console.warn(`[WARN] Could not parse ${filePath}:`, err.message);
  }
  return env;
}

// Password hashing compatible with apps/api/src/common/utils/bcrypt.util.ts
async function hashPassword(plainText) {
  try {
    const bcrypt = require('bcrypt');
    if (typeof bcrypt.hash === 'function') {
      return await bcrypt.hash(plainText, 10);
    }
  } catch {}

  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function provisionFactory(key, config) {
  const baseEnv = parseEnv(path.resolve(rootDir, '.env'));
  const factoryEnv = parseEnv(path.resolve(rootDir, config.file));
  
  // Factory-specific env strictly overrides base .env and existing process.env
  const targetDbUrl = factoryEnv.DATABASE_URL || baseEnv.DATABASE_URL || process.env.DATABASE_URL;

  if (!targetDbUrl) {
    console.error(`❌ [${config.code}] Skipped: DATABASE_URL not found in ${config.file}`);
    return false;
  }

  // Set process.env.DATABASE_URL so Prisma client connects to this factory's database
  process.env.DATABASE_URL = targetDbUrl;

  const email = (customEmail || factoryEnv.ADMIN_EMAIL || baseEnv.ADMIN_EMAIL || config.defaultEmail).toLowerCase().trim();
  const password = (customPassword || factoryEnv.ADMIN_PASSWORD || baseEnv.ADMIN_PASSWORD || 'Password123!').trim();
  const name = (customName || factoryEnv.ADMIN_NAME || baseEnv.ADMIN_NAME || `${config.code} Administrator`).trim();
  const role = customRole;

  const maskedDb = targetDbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`\n🏢 Provisioning Admin for: ${config.name} (${config.code})`);
  console.log(`   🗄️ Database: ${maskedDb}`);
  console.log(`   📧 Email:    ${email}`);

  // Dynamically instantiate PrismaClient with this factory's DATABASE_URL
  const { PrismaClient } = require('../packages/database/generated/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: targetDbUrl,
      },
    },
  });

  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { email } });

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { email },
        data: {
          name,
          passwordHash,
          role,
          isActive: true,
        },
      });
      console.log(`   ✅ Existing admin updated (ID: ${user.id})`);
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          isActive: true,
          employeeId: `ADM-${config.code}`,
        },
      });
      console.log(`   ✅ New admin created (ID: ${user.id})`);
    }

    console.log(`   🔑 Credentials: ${email} | ${password} (${role})`);
    return true;
  } catch (err) {
    console.error(`   ❌ Failed to provision ${config.code}: ${err.message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('\n' + '='.repeat(64));
  console.log('  👑 Enterprise Multi-Company Admin Provisioning');
  console.log('='.repeat(64));

  const targets =
    target === 'all'
      ? ['cmbd', 'cetbd', 'abl']
      : [target];

  for (const t of targets) {
    const config = FACTORIES[t];
    if (!config) {
      console.error(`❌ Unknown factory "${t}". Valid options: cmbd, cetbd, abl, all`);
      continue;
    }
    await provisionFactory(t, config);
  }

  console.log('\n' + '='.repeat(64));
  console.log('🎉 Done! You can now log into the Web App or Mobile App with:');
  console.log(`   Email:    ${customEmail || 'admin@assetmgmt.com'}`);
  console.log(`   Password: ${customPassword || 'Password123!'}`);
  console.log('='.repeat(64) + '\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
