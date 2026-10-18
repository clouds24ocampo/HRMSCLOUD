#!/usr/bin/env node
// PreToolUse hook for Write|Edit|MultiEdit. Fast tripwire for rule S-1 (no secrets in code).
// It is NOT a replacement for gitleaks (pre-commit + CI), which stays the real control.
//
// Blocks (exit 2, message goes back to the model):
//   - writes to real env files (.env, .env.local, .env.production ...); .env.example/.sample/.template are fine
//   - content containing a private key, AWS key id, GitHub/Slack token, or a hard-coded credential
// A line containing "gitleaks:allow" is skipped (same marker gitleaks honors).
// Malformed hook input fails open (exit 0) so a bug here cannot brick the session.

import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const ti = input?.tool_input ?? {};
const filePath = String(ti.file_path ?? '').replace(/\\/g, '/');
const base = filePath.split('/').pop() ?? '';

if (/^\.env(\..+)?$/i.test(base) && !/^\.env\.(example|sample|template)$/i.test(base)) {
  block(`${base} is a real env file. Do not write secrets through the agent (S-1). Put names and dummy values in .env.example and edit the real file yourself.`);
}

const texts = [];
if (typeof ti.content === 'string') texts.push(ti.content);
if (typeof ti.new_string === 'string') texts.push(ti.new_string);
if (Array.isArray(ti.edits)) for (const e of ti.edits) if (typeof e?.new_string === 'string') texts.push(e.new_string);

const FIXED = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
];
const ASSIGN =
  /\b[\w-]*(?:password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret)[\w-]*\s*[:=]\s*(["'`])([^"'`\s]{12,})\1/i;
const PLACEHOLDER = /^(?:change[-_ ]?me|example|dummy|sample|placeholder|your[-_]|test|x{3,}|\*+|<.*>|\$\{.*\}|\{\{.*\}\}|process\.env|env\.)|example/i;

const hits = [];
for (const text of texts) {
  text.split('\n').forEach((line, i) => {
    if (line.includes('gitleaks:allow')) return;
    for (const [label, re] of FIXED) if (re.test(line)) hits.push(`line ${i + 1}: ${label}`);
    const m = line.match(ASSIGN);
    // Require a digit or symbol so identifiers like "my-kubernetes-secret-name" are not flagged.
    if (m && !PLACEHOLDER.test(m[2]) && /[\d!@#$%^&*]/.test(m[2])) hits.push(`line ${i + 1}: hard-coded credential`);
  });
}

if (hits.length) {
  block(
    `Possible secret in ${base || 'this write'} (${hits.slice(0, 5).join('; ')}). ` +
      'Use an environment variable or the secret manager (S-1). If this is a harmless fixture, add "gitleaks:allow" on that line.',
  );
}
process.exit(0);

function block(message) {
  process.stderr.write(`worksync guard-secrets: ${message}\n`);
  process.exit(2);
}
