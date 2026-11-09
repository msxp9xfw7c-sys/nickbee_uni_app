const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const distPath = path.join(__dirname, 'dist');
const serverBundlePath = path.join(distPath, 'server.cjs');
const clientEntryPath = path.join(distPath, 'index.html');

if (!fs.existsSync(serverBundlePath) || !fs.existsSync(clientEntryPath)) {
  execFileSync('npm', ['run', 'build'], { cwd: __dirname, stdio: 'inherit' });
}

require(serverBundlePath);
