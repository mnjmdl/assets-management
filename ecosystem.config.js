const path = require('path');
const fs = require('fs');

function loadEnv(filePath) {
  const vars = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const i = trimmed.indexOf('=');
        const k = trimmed.slice(0, i).trim();
        let v = trimmed.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        vars[k] = v;
      }
    }
  }
  return vars;
}

const rootEnv = loadEnv(path.resolve(__dirname, '.env'));
const apiEnv = loadEnv(path.resolve(__dirname, 'apps/api/.env'));
const mergedApiEnv = { ...rootEnv, ...apiEnv };

module.exports = {
  apps: [
    {
      name: 'assets-api',
      script: 'dist/main.js',
      cwd: './apps/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        ...mergedApiEnv,
        NODE_ENV: 'production',
        API_PORT: 3001,
      },
    },
    {
      name: 'assets-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './apps/web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        ...rootEnv,
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};

