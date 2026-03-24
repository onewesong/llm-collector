import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const sources = [
  // Claude
  { vendor: 'claude', name: 'pricing', url: 'https://platform.claude.com/docs/en/about-claude/pricing.md', rejectPatterns: ['App unavailable in region'] },
  { vendor: 'claude', name: 'api-messages', url: 'https://docs.claude.com/en/api/messages', rejectPatterns: [] },
  { vendor: 'claude', name: 'api-completions', url: 'https://docs.claude.com/en/api/completions', rejectPatterns: [] },
  { vendor: 'claude', name: 'api-models', url: 'https://docs.claude.com/en/docs/about-claude/models', rejectPatterns: [] },
  { vendor: 'claude', name: 'api-error-codes', url: 'https://docs.claude.com/en/api/errors', rejectPatterns: [] },
  { vendor: 'claude', name: 'api-rate-limits', url: 'https://docs.claude.com/en/api/rate-limits', rejectPatterns: [] },

  // OpenAI
  { vendor: 'openai', name: 'pricing', url: 'https://developers.openai.com/api/docs/pricing.md', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-introduction', url: 'https://platform.openai.com/docs/api-reference/introduction', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-chat', url: 'https://platform.openai.com/docs/api-reference/chat', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-responses', url: 'https://platform.openai.com/docs/api-reference/responses', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-models', url: 'https://platform.openai.com/docs/models', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-errors', url: 'https://platform.openai.com/docs/guides/error-codes', rejectPatterns: [] },
  { vendor: 'openai', name: 'api-rate-limits', url: 'https://platform.openai.com/docs/guides/rate-limits', rejectPatterns: [] },
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
