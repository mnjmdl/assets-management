#!/usr/bin/env node

/**
 * Enterprise Multi-Factory API Runner
 * 
 * Runs the Assets Management NestJS API configured for a specific factory:
 *   - CMBD:  Crystal Martin Bangladesh
 *   - CETBD: CETBD Enterprise
 *   - ABL:   Apex / ABL Group
 * 
 * Usage:
 *   npm run api:cmbd
 *   npm run api:cetbd
 *   npm run api:abl
 * 
 * Development mode (watch):
 *   npm run api:cmbd:dev
 *   npm run api:cetbd:dev
 *   npm run api:abl:dev
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.resolve(rootDir, 'apps/api');

// Parse CLI arguments
const args = process.argv.slice(2);
const rawTarget = args.find((a) => !a.startsWith('-')) || 'cmbd';
const target = rawTarget.toLowerCase().trim();
const isDev = args.includes('--dev') || args.includes('-d');

// Optional port override from CLI: --port 3005
const portIdx = args.findIndex((a) => a === '--port' || a === '-p');
const cliPort = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : null;

// Factory metadata definitions
const FACTORY_CONFIGS = {
  cmbd: {
    code: 'CMBD',
    name: 'Crystal Martin Bangladesh',
    defaultPort: 3001,
    envFile: '.env.cmbd',
    defaultDbUrl:
      process.env.DATABASE_URL_CMBD ||
      process.env.DATABASE_URL ||
      'sqlserver://192.168.65.50:1433;database=AssetsManagement;user=cmaautocutter;password=Crystal@123;encrypt=true;trustServerCertificate=true',
  },
  cetbd: {
    code: 'CETBD',
    name: 'CETBD Enterprise',
    defaultPort: 3002,
    envFile: '.env.cetbd',
    defaultDbUrl:
      process.env.DATABASE_URL_CETBD ||
      process.env.DATABASE_URL ||
      'sqlserver://192.168.65.50:1433;database=AssetsManagement_CETBD;user=cmaautocutter;password=Crystal@123;encrypt=true;trustServerCertificate=true',
  },
  abl: {
    code: 'ABL',
    name: 'Apex / ABL Group',
    defaultPort: 3003,
    envFile: '.env.abl',
    defaultDbUrl:
      process.env.DATABASE_URL_ABL ||
      process.env.DATABASE_URL ||
      'sqlserver://192.168.45.51:1433;database=AssetsManagement;user=cmaautocutter;password=Crystal@123;encrypt=true;trustServerCertificate=true',
  },
};

const factory = FACTORY_CONFIGS[target];

if (!factory) {
  console.error(`\n❌ Error: Unknown factory "${rawTarget}".`);
  console.error(`   Supported factories are: cmbd, cetbd, abl\n`);
  process.exit(1);
}

// ── 1. Load Environment Files ────────────────────────────────────────────────
// Base env file (.env) first, then factory-specific env file (.env.<factory>)
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[WARN] Could not parse ${filePath}:`, err.message);
  }
  return env;
}

const baseEnv = parseEnvFile(path.resolve(rootDir, '.env'));
const factoryEnv = parseEnvFile(path.resolve(rootDir, factory.envFile));

// Merge environment: process.env < baseEnv < factoryEnv
const mergedEnv = {
  ...process.env,
  ...baseEnv,
  ...factoryEnv,
};

// Set specific factory overrides
mergedEnv.COMPANY_CODE = factory.code;
mergedEnv.COMPANY_NAME = factory.name;
mergedEnv.API_PORT = String(cliPort || mergedEnv.API_PORT || factory.defaultPort);
mergedEnv.PORT = mergedEnv.API_PORT;

if (!mergedEnv.DATABASE_URL) {
  mergedEnv.DATABASE_URL = factory.defaultDbUrl;
}

// Ensure CORS allows the web app
if (!mergedEnv.CORS_ORIGIN) {
  mergedEnv.CORS_ORIGIN = 'http://localhost:3000';
}

// ── 2. Display Launch Banner ─────────────────────────────────────────────────
const maskedDb = mergedEnv.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
console.log('\n' + '='.repeat(68));
console.log(`  🏢 Assets Management - Factory API Launcher`);
console.log(`  Factory:     ${factory.name} (${factory.code})`);
console.log(`  Mode:        ${isDev ? 'Development (Hot-Reload / Watch)' : 'Production'}`);
console.log(`  Port:        ${mergedEnv.API_PORT}`);
console.log(`  Endpoint:    http://0.0.0.0:${mergedEnv.API_PORT}/api/v1`);
console.log(`  Swagger:     http://localhost:${mergedEnv.API_PORT}/api/docs`);
console.log(`  Database:    ${maskedDb}`);
console.log('='.repeat(68) + '\n');

// ── 3. Build API if production and dist does not exist ────────────────────────
const distMain = path.resolve(apiDir, 'dist/main.js');
if (!isDev && !fs.existsSync(distMain)) {
  console.log('📦 Production build not found. Compiling API with "nest build"...');
  try {
    execSync('npm run build', { cwd: apiDir, stdio: 'inherit' });
    console.log('✅ API build successful.\n');
  } catch (err) {
    console.error('❌ Failed to build API:', err.message);
    process.exit(1);
  }
}

// ── 4. Launch NestJS Process ─────────────────────────────────────────────────
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

let child;
if (isDev) {
  // Run nest start --watch in api directory
  child = spawn(npxCmd, ['nest', 'start', '--watch'], {
    cwd: apiDir,
    env: mergedEnv,
    stdio: 'inherit',
    shell: isWindows,
  });
} else {
  // Run compiled node dist/main
  child = spawn(process.execPath, [distMain], {
    cwd: apiDir,
    env: mergedEnv,
    stdio: 'inherit',
  });
}

// Handle shutdown
const cleanExit = (signal) => {
  if (child && !child.killed) {
    child.kill(signal);
  }
  process.exit(0);
};

process.on('SIGINT', () => cleanExit('SIGINT'));
process.on('SIGTERM', () => cleanExit('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code || 0);
});
