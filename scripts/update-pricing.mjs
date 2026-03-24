import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

function fetchUrl(url) {
  try {
    return { ok: true, body: execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) };
  } catch (e) {
    return { ok: false, body: `ERROR_FETCHING_URL\n${String(e.stderr || e.message || e)}` };
  }
}

function isBadContent(body, patterns) {
  return patterns.some((p) => body.includes(p));
}

function parseSourcesYaml(yml) {
  const lines = yml.split(/\r?\n/);
  const items = [];
  let vendor = null;
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m = line.match(/^\s{2}([a-z0-9_-]+):\s*$/i);
    if (m) { vendor = m[1]; continue; }
    m = line.match(/^\s{4}-\s+name:\s*(\S+)\s*$/);
    if (m) { current = { vendor, name: m[1], rejectPatterns: [] }; items.push(current); continue; }
    m = line.match(/^\s{6}url:\s*(\S+)\s*$/);
    if (m && current) { current.url = m[1]; continue; }
    m = line.match(/^\s{6}rejectPatterns:\s*$/);
    if (m && current) { current.rejectPatterns = []; continue; }
    m = line.match(/^\s{8}-\s*(.+)\s*$/);
    if (m && current) { current.rejectPatterns.push(m[1]); continue; }
  }
  return items.filter(x => x.vendor && x.name && x.url);
}

const sourcesPath = 'sources/index.yml';
const sources = parseSourcesYaml(readFileSync(sourcesPath, 'utf8'));
const stamp = new Date().toISOString();
for (const src of sources) {
  const result = fetchUrl(src.url);
  const file = `data/${src.vendor}/${src.name}.md`;
  mkdirSync(dirname(file), { recursive: true });
  if ((!result.ok || isBadContent(result.body, src.rejectPatterns)) && existsSync(file)) {
    console.log(`skipped ${file} (fetch failed or rejected, keeping existing snapshot)`);
    continue;
  }
  const out = `# ${src.vendor} ${src.name}\n\nGenerated at: ${stamp}\n\nSource: ${src.url}\n\n${result.body.trimEnd()}\n`;
  writeFileSync(file, out);
  console.log(`updated ${file}`);
}
