#!/usr/bin/env node
// Assembles the Claude Code plugin in plugin/worksync from the single source of
// truth (.agents/ and scripts/authz-guard.mjs) so the two never drift.
//   node scripts/build-plugin.mjs           write generated files
//   node scripts/build-plugin.mjs --check   fail if the plugin copy is missing or stale
//
// Generated:  plugin/worksync/agents/*.md, skills/**, hooks/authz-guard.mjs
// Hand-written (not touched): .claude-plugin/plugin.json, hooks/hooks.json,
//   hooks/guard-secrets.mjs, hooks/post-api-guard.mjs, commands/*.md
//
// Review-type roles get a read-only tool list in the plugin copy so a reviewer cannot
// silently "fix" the code it is reviewing (collaboration rule in MASTER_GUIDE section 13).

import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const PLUGIN = 'plugin/worksync';
const AGENTS_SRC = '.agents/agents';
const SKILLS_SRC = '.agents/skills';
const READ_ONLY_ROLES = new Set(['reviewer', 'security', 'privacy-compliance']);
const READ_ONLY_TOOLS = 'Read, Grep, Glob, Bash';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function withTools(text, role) {
  if (!READ_ONLY_ROLES.has(role)) return text;
  // Insert "tools:" right after the description line inside the frontmatter.
  return text.replace(/^(description: .*)$/m, `$1\ntools: ${READ_ONLY_TOOLS}`);
}

function expected() {
  const out = new Map();
  for (const file of readdirSync(AGENTS_SRC).filter((f) => f.endsWith('.md')).sort()) {
    const text = readFileSync(join(AGENTS_SRC, file), 'utf8');
    const role = text.match(/^name: (.+)$/m)?.[1]?.trim();
    if (!role) throw new Error(`${file}: missing "name:" in frontmatter`);
    out.set(`agents/${role}.md`, withTools(text, role));
  }
  for (const file of walk(SKILLS_SRC)) {
    out.set(`skills/${relative(SKILLS_SRC, file).split('\\').join('/')}`, readFileSync(file, 'utf8'));
  }
  out.set('hooks/authz-guard.mjs', readFileSync('scripts/authz-guard.mjs', 'utf8'));
  return out;
}

const check = process.argv.includes('--check');
const files = expected();
const bad = [];
for (const [rel, text] of files) {
  const dest = join(PLUGIN, rel);
  if (check) {
    if (!existsSync(dest)) bad.push(`missing  ${dest}`);
    else if (readFileSync(dest, 'utf8') !== text) bad.push(`stale    ${dest}`);
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
  }
}

if (check) {
  if (bad.length) {
    console.error(bad.join('\n'));
    console.error('plugin out of sync. Run: node scripts/build-plugin.mjs');
    process.exit(1);
  }
  console.log(`plugin ok (${files.size} generated files)`);
} else {
  console.log(`plugin built (${files.size} generated files) in ${PLUGIN}`);
}
