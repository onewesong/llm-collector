import { readFileSync, writeFileSync } from 'node:fs';

const yml = readFileSync('sources/index.yml', 'utf8');
const lines = yml.split(/\r?\n/);
const vendors = [];
let vendor = null;
let inSources = false;
let count = 0;
for (const raw of lines) {
  const line = raw.trimEnd();
  let m = line.match(/^\s{2}([a-z0-9_-]+):\s*$/i);
  if (m) { vendor = { name: m[1], count: 0 }; vendors.push(vendor); continue; }
  m = line.match(/^\s{4}sources:\s*$/); if (m) { inSources = true; continue; }
  m = line.match(/^\s{6}-\s+name:\s*(\S+)\s*$/); if (m && inSources && vendor) { vendor.count++; count++; }
}
writeFileSync('README.md', `# intel-collector\n\nModel intelligence collection repo.\n\n- Vendors: ${vendors.length}\n- Sources: ${count}\n\nSee \`docs/index.md\` for the generated collection index.\n`);
console.log('updated README.md');
