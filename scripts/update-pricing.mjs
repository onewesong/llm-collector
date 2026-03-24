import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const sources = [
  {
    name: 'claude',
    url: 'https://platform.claude.com/docs/en/about-claude/pricing.md',
    rejectPatterns: ['App unavailable in region'],
  },
  {
    name: 'openai',
    url: 'https://developers.openai.com/api/docs/pricing.md',
    rejectPatterns: [],
  },
];

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

const stamp = new Date().toISOString();
for (const src of sources) {
  const result = fetchUrl(src.url);
  const file = `data/${src.name}/pricing-snapshot.md`;
  mkdirSync(dirname(file), { recursive: true });

  if ((!result.ok || isBadContent(result.body, src.rejectPatterns)) && existsSync(file)) {
    console.log(`skipped ${file} (fetch failed or rejected, keeping existing snapshot)`);
    continue;
  }

  const out = `# ${src.name} pricing snapshot\n\nGenerated at: ${stamp}\n\nSource: ${src.url}\n\n${result.body.trimEnd()}\n`;
  writeFileSync(file, out);
  console.log(`updated ${file}`);
}
