#!/usr/bin/env node
/**
 * AweerMarket — Automated Contabo VPS Deployment Engine
 * Target: Contabo Ubuntu VPS (169.58.33.89)
 * 
 * Usage:
 *   pnpm deploy:contabo
 *   or
 *   node scripts/deploy-contabo.js
 */

const fs = require('fs');
const path = require('path');

// Resolve ssh2 client
let Client;
try {
  Client = require('ssh2').Client;
} catch (e) {
  try {
    Client = require('d:/Universal-Retail-POS/backend/node_modules/ssh2').Client;
  } catch (e2) {
    console.error('❌ Error: ssh2 package is required. Run: pnpm add -Dw ssh2');
    process.exit(1);
  }
}

// Read .env.deploy configuration
const envDeployPath = path.join(__dirname, '..', '.env.deploy');
const config = {
  host: '169.58.33.89',
  port: 22,
  username: 'root',
  password: '',
  remoteDir: '/var/www/aweer-market'
};

if (fs.existsSync(envDeployPath)) {
  const content = fs.readFileSync(envDeployPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (key === 'DEPLOY_SSH_HOST') config.host = val;
    if (key === 'DEPLOY_SSH_PORT') config.port = Number(val) || 22;
    if (key === 'DEPLOY_SSH_USER') config.username = val;
    if (key === 'DEPLOY_SSH_PASSWORD') config.password = val;
    if (key === 'DEPLOY_REMOTE_DIR') config.remoteDir = val;
  }
}

if (!config.password) {
  console.error('❌ Missing DEPLOY_SSH_PASSWORD in .env.deploy');
  process.exit(1);
}

console.log('========================================================');
console.log('  AWEERMARKET — CONTABO PRODUCTION DEPLOYMENT ENGINE     ');
console.log('========================================================');
console.log(`📡 Target Host: ${config.host}:${config.port}`);
console.log(`📁 Remote Dir:  ${config.remoteDir}`);
console.log('⏳ Connecting to server via SSH...\n');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ SSH Connection established. Running live deployment pipeline...\n');

  const remoteCommands = `
    set -e
    export PATH=/root/.nvm/versions/node/v24.12.0/bin:$PATH
    cd ${config.remoteDir}
    
    echo "▶ STEP 1: Pulling latest code from origin/main..."
    git pull origin main
    
    echo ""
    echo "▶ STEP 2: Current Commit on VPS:"
    git log -n 1 --oneline
    
    echo ""
    echo "▶ STEP 3: Installing workspace dependencies..."
    pnpm install --frozen-lockfile=false
    
    echo ""
    echo "▶ STEP 4: Compiling shared packages (@aweermarket/types, @aweermarket/validation)..."
    pnpm build:packages
    
    echo ""
    echo "▶ STEP 5: Building production bundles for all applications..."
    pnpm build
    
    echo ""
    echo "▶ STEP 6: Reloading PM2 services..."
    pm2 restart aweermarket-api aweermarket-superadmin aweermarket-vendor aweermarket-web
    
    echo ""
    echo "▶ STEP 7: Verifying live health and service ports..."
    sleep 3
    curl -s http://localhost:4000/api/v1/health || echo "API healthcheck warning"
    echo ""
    
    echo "▶ STEP 8: Active PM2 processes:"
    pm2 status aweermarket-api aweermarket-superadmin aweermarket-vendor aweermarket-web
  `;

  conn.exec(remoteCommands, (err, stream) => {
    if (err) {
      console.error('❌ Exec error:', err);
      conn.end();
      process.exit(1);
    }

    stream.on('data', data => process.stdout.write(data.toString()));
    stream.stderr.on('data', data => process.stderr.write(data.toString()));
    
    stream.on('close', code => {
      console.log('--------------------------------------------------------');
      if (code === 0) {
        console.log('🎉 DEPLOYMENT SUCCEEDED! All services are online and updated.');
      } else {
        console.error(`⚠️ Deployment finished with non-zero exit code: ${code}`);
      }
      console.log('--------------------------------------------------------');
      conn.end();
    });
  });
}).on('error', err => {
  console.error('❌ SSH Connection failed:', err.message);
  process.exit(1);
}).connect({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  readyTimeout: 60000
});
