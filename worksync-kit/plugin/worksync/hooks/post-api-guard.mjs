#!/usr/bin/env node
// PostToolUse hook for Write|Edit|MultiEdit. After the model edits a controller, gateway,
// module, or main.ts under apps/api/src, re-run the authorization lint (rule Z-1). On a
// finding the output goes back to the model (exit 2) so it fixes the guard instead of moving on.
//
// Uses the project's own scripts/authz-guard.mjs when present (so CI and the hook agree),
// otherwise the copy bundled with the plugin. The lint is one signal, not proof of Z-1.
// Note: while scaffolding, a new controller can trip rule A1/A4 until the global guard and
// ValidationPipe exist; that is intended. Remove this hook from hooks.json if it gets in the way.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file = String(input?.tool_input?.file_path ?? '').replace(/\\/g, '/');
if (!/\.(controller|gateway|module)\.ts$|\/main\.ts$/.test(file)) process.exit(0);
const m = file.match(/^(.*\/apps\/api\/src)\//);
if (!m) process.exit(0);

const cwd = input.cwd ?? process.cwd();
const local = join(cwd, 'scripts', 'authz-guard.mjs');
const bundled = join(dirname(fileURLToPath(import.meta.url)), 'authz-guard.mjs');
const script = existsSync(local) ? local : bundled;

const r = spawnSync(process.execPath, [script, m[1]], { encoding: 'utf8', cwd });
if (r.status === 0) process.exit(0);

process.stderr.write(
  `WorkSync authz lint failed after editing ${file}\n${r.stdout ?? ''}${r.stderr ?? ''}\n` +
    'Fix the finding (see skill permission-model-review). Do not weaken the lint. A public route needs an ' +
    'allow-list entry in docs/security/public-routes.json with a reason and an ADR (X-1).\n',
);
process.exit(2);
