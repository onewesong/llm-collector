import { readFileSync } from 'node:fs';

const path = 'sources/index.yml';
const text = readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);
let currentVendor = null;
let currentItem = null;
const seen = new Set();
let vendors = 0;

for (const raw of lines) {
  const line = raw.trimEnd();
  if (!line || line === 'vendors:') continue;
  let m = line.match(/^\s{2}([a-z0-9_-]+):\s*$/i);
  if (m) { currentVendor = m[1]; vendors++; continue; }
  m = line.match(/^\s{4}-\s+name:\s*(\S+)\s*$/);
  if (m) { currentItem = { name: m[1] }; continue; }
  m = line.match(/^\s{6}url:\s*(\S+)\s*$/);
  if (m) {
    if (!currentVendor || !currentItem) throw new Error(`Invalid order near: ${raw}`);
    const key = `${currentVendor}/${currentItem.name}`;
    if (seen.has(key)) throw new Error(`Duplicate source: ${key}`);
    seen.add(key);
    continue;
  }
}
if (vendors === 0 || seen.size === 0) throw new Error('No vendors or sources found');
console.log(`validated ${vendors} vendors, ${seen.size} sources`);
