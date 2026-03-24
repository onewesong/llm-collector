import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_TIMEOUT = '20';

function probeUrl(url, timeoutSeconds = DEFAULT_TIMEOUT) {
  try {
    const out = execFileSync('curl', ['-L', '--silent', '--show-error', '--max-time', String(timeoutSeconds), '-o', '/dev/null', '-w', '%{url_effective}', url], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return out.trim();
  } catch {
    return url;
  }
}

function fetchUrl(url, timeoutSeconds = DEFAULT_TIMEOUT) {
  try {
    const body = execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '--max-time', String(timeoutSeconds), url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, body };
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
  let inSources = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m = line.match(/^\s{2}([a-z0-9_-]+):\s*$/i);
    if (m) { vendor = m[1]; continue; }
    m = line.match(/^\s{4}sources:\s*$/);
    if (m) { inSources = true; continue; }
    m = line.match(/^\s{6}-\s+name:\s*(\S+)\s*$/);
    if (m && inSources) {
      current = { vendor, name: m[1], enabled: true, priority: 99, tags: [], rejectPatterns: [], fetchMode: 'markdown', timeoutSeconds: DEFAULT_TIMEOUT };
      items.push(current);
      continue;
    }
    if (!current) continue;
    m = line.match(/^\s{8}url:\s*(\S+)\s*$/); if (m) { current.url = m[1]; continue; }
    m = line.match(/^\s{8}enabled:\s*(true|false)\s*$/); if (m) { current.enabled = m[1] === 'true'; continue; }
    m = line.match(/^\s{8}priority:\s*(\d+)\s*$/); if (m) { current.priority = Number(m[1]); continue; }
    m = line.match(/^\s{8}fetchMode:\s*(\S+)\s*$/); if (m) { current.fetchMode = m[1]; continue; }
    m = line.match(/^\s{8}outputPath:\s*(\S+)\s*$/); if (m) { current.outputPath = m[1]; continue; }
    m = line.match(/^\s{8}timeoutSeconds:\s*(\d+)\s*$/); if (m) { current.timeoutSeconds = Number(m[1]); continue; }
    m = line.match(/^\s{8}tags:\s*\[(.*)\]\s*$/); if (m) { current.tags = m[1].split(',').map(s => s.trim()).filter(Boolean); continue; }
    m = line.match(/^\s{8}notes:\s*(.+)$/); if (m) { current.notes = m[1]; continue; }
    m = line.match(/^\s{8}rejectPatterns:\s*$/); if (m) { current.rejectPatterns = []; continue; }
    m = line.match(/^\s{10}-\s*(.+)\s*$/); if (m) { current.rejectPatterns.push(m[1]); continue; }
  }
  return items.filter(x => x.vendor && x.name && x.url && x.enabled !== false).sort((a,b)=>(a.priority??99)-(b.priority??99));
}

function resolveSourceUrl(src) {
  if (src.url.endsWith('.md') || src.url.endsWith('.txt')) return src.url;
  const md = `${src.url}.md`;
  const effective = probeUrl(md, src.timeoutSeconds);
  if (effective.endsWith('.md') || effective.endsWith('.txt')) return effective;
  return src.url;
}

const sources = parseSourcesYaml(readFileSync('sources/index.yml', 'utf8'));
for (const src of sources) {
  const effectiveUrl = resolveSourceUrl(src);
  const result = fetchUrl(effectiveUrl, src.timeoutSeconds);
  const file = src.outputPath || `data/${src.vendor}/${src.name}.md`;
  mkdirSync(dirname(file), { recursive: true });
  const body = result.ok ? result.body : result.body;
  if ((!result.ok || isBadContent(body, src.rejectPatterns)) && existsSync(file)) {
    console.log(`skipped ${file} (fetch failed or rejected, keeping existing snapshot)`);
    continue;
  }
  writeFileSync(file, body.trimEnd() + '\n');
  console.log(`updated ${file}`);
}
