import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = 'TODAY_DIFF.md';
const stamp = new Date().toISOString().slice(0, 10);
const prev = existsSync(path) ? readFileSync(path, 'utf8') : '# Today Diff\n\n';
const next = `# Today Diff\n\n- ${stamp}: review the latest snapshot changes in the vendor docs.\n` + prev.split(/\r?\n/).slice(2).join('\n') + '\n';
writeFileSync(path, next);
console.log('updated TODAY_DIFF.md');
