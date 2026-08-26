const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(envPath);
      } catch {
        // ignore load errors
      }
    } else {
      // 简易手动解析 .env，无需第三方依赖
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const config = {
  webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:5173',
  adminBaseUrl: process.env.ADMIN_BASE_URL || 'http://localhost:8080',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  browser: (process.env.E2E_BROWSER || 'chrome').toLowerCase(),
  headless: process.env.E2E_HEADLESS !== 'false',
  timeout: parseInt(process.env.E2E_TIMEOUT || '10000', 10),
  adminUsername: process.env.E2E_ADMIN_USERNAME || '',
  adminPassword: process.env.E2E_ADMIN_PASSWORD || '',
  coachUsername: process.env.E2E_COACH_USERNAME || '',
  coachPassword: process.env.E2E_COACH_PASSWORD || '',
};

module.exports = config;
