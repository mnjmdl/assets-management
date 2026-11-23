#!/usr/bin/env node

/**
 * Enterprise Multi-Factory Prisma DB Push
 * 
 * Automatically applies Prisma schema directly to the specified factory database:
 *   - CMBD:  Crystal Martin Bangladesh (reads .env.cmbd)
 *   - CETBD: CETBD Enterprise          (reads .env.cetbd)
 *   - ABL:   Crystal / ABL Group       (reads .env.abl)
 * 
 * Usage:
 *   npm run db:push:cmbd
 *   npm run db:push:cetbd
 *   npm run db:push:abl
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const dbDir = path.resolve(rootDir, 'packages/database');

const target = (process.argv[2] || 'cmbd').toLowerCase().trim();

const FACTORY_ENVS = {
  cmbd: { name: 'Crystal Martin Bangladesh (CMBD)', file: '.env.cmbd' },
  cetbd: { name: 'CETBD Enterprise (CETBD)', file: '.env.cetbd' },
  abl: { name: 'Crystal / ABL Group (ABL)', file: '.env.abl' },
};

const factory = FACTORY_ENVS[target];
if (!factory) {
  console.error(`\n❌ Unknown factory "${target}".`);
  console.error(`   Supported factories: cmbd, cetbd, abl\n`);
  process.exit(1);
}

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

const baseEnv = parseEnv(path.resolve(rootDir, '.env'));
const factoryEnv = parseEnv(path.resolve(rootDir, factory.file));
const mergedEnv = { ...process.env, ...baseEnv, ...factoryEnv };

if (!mergedEnv.DATABASE_URL) {
  console.error(`\n❌ Error: DATABASE_URL is not set in ${factory.file} or root .env\n`);
  process.exit(1);
}

const maskedDb = mergedEnv.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
console.log('\n' + '='.repeat(64));
console.log(`  🔄 Prisma DB Push - Factory Database Deployment`);
console.log(`  Factory:       ${factory.name}`);
console.log(`  Config File:   ${factory.file}`);
console.log(`  Database Target: ${maskedDb}`);
console.log('='.repeat(64) + '\n');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const extraArgs = process.argv.slice(3);
const result = spawnSync(npxCmd, ['prisma', 'db', 'push', ...extraArgs], {
  cwd: dbDir,
  env: mergedEnv,
  stdio: 'inherit',
  shell: isWindows,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`\n✅ Schema successfully pushed to ${factory.name} database!\n`);
