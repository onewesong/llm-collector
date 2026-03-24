import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

function parseSources(md) {
  const lines = md.split(/\r?\n/);
  const items = [];
  let vendor = '';
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      vendor = heading[1].trim().toLowerCase();
      continue;
    }
    const item = line.match(/^-\s+([^\s]+)\s+—\s+(https?:\/\/\S+)$/);
    if (item && vendor) {
      items.push({ vendor, name: item[1], url: item[2], rejectPatterns: vendor === 'anthropic' && item[1] === 'pricing' ? ['App unavailable in region'] : [] });
    }
  }
  return items;
}

const sourcesPath = join(process.cwd(), 'sources/index.md');
const sourcesMd = readFileSync(sourcesPath, 'utf8');
const sources = parseSources(sourcesMd);
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
