// Bundle server-core into mobile's nodejs-assets for embedded Node (no Termux)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDist = path.join(root, 'packages/server-core/dist');
const srcSchema = path.join(root, 'packages/server-core/src/db/schema.sql');
const destRoot = path.join(root, 'packages/mobile-server/nodejs-assets/nodejs-project');
const destServer = path.join(destRoot, 'server');
const destData = path.join(destRoot, 'data');

if (!fs.existsSync(srcDist)) {
  console.error('Missing server-core/dist — run: npm run build --workspace=server-core');
  process.exit(1);
}
const srcWeb = path.join(root, 'packages/web-client/dist');
if (!fs.existsSync(srcWeb)) {
  console.error('Missing web-client/dist — run: npm run build --workspace=web-client');
  process.exit(1);
}

fs.mkdirSync(destServer, { recursive: true });
fs.mkdirSync(destData, { recursive: true });

// Copy dist files recursively
function copyDir(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
}
copyDir(srcDist, destServer);
fs.copyFileSync(srcSchema, path.join(destServer, 'db', 'schema.sql'));
// Copy web SPA to nodejs-project/public for Express static (last candidate in server.ts: ../public)
const destPublic = path.join(destRoot, 'public');
fs.mkdirSync(destPublic, { recursive: true });
copyDir(srcWeb, destPublic);
console.log('Bundled server-core/dist →', destServer);
console.log('Bundled schema.sql →', path.join(destServer, 'db/schema.sql'));
console.log('Bundled web-client/dist →', destPublic, '(served at http://192.168.43.1:3000/)');
console.log('Done. Now run: npx expo run:android  (Dev Build with embedded Node + SQLite, no Termux)');
