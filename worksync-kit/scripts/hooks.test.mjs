// Tests for the plugin hooks.  Run: node --test scripts/hooks.test.mjs
// Fake secrets are assembled from pieces so this file itself does not trip secret scanners.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugin', 'worksync', 'hooks');
const run = (script, payload, raw, cwd) =>
  spawnSync(process.execPath, [join(HOOKS, script)], { input: raw ?? JSON.stringify(payload), encoding: 'utf8', cwd });
const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });

const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----\nabc\n';
const AWS = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';

test('guard-secrets: real env files blocked, example files allowed', () => {
  assert.equal(run('guard-secrets.mjs', write('/p/.env', 'A=1')).status, 2);
  assert.equal(run('guard-secrets.mjs', write('/p/.env.example', 'DB_PASSWORD=changeme')).status, 0);
});

test('guard-secrets: blocks keys and hard-coded credentials, allows placeholders and env lookups', () => {
  const w = (c) => run('guard-secrets.mjs', write('/p/a.ts', c)).status;
  assert.equal(w(PEM), 2);
  assert.equal(w(`k = ${AWS}`), 2);
  assert.equal(w('const password = "Sup3rS3cretValue!";'), 2);
  assert.equal(w('const password = process.env.DB_PASSWORD;'), 0);
  assert.equal(w('const password = "changeme-please-123";'), 0);
  assert.equal(w('const x = 1; // gitleaks:allow'), 0);
});

test('guard-secrets: checks Edit and MultiEdit; malformed input fails open', () => {
  assert.equal(run('guard-secrets.mjs', { tool_input: { file_path: '/p/a.ts', new_string: `k=${AWS}` } }).status, 2);
  assert.equal(run('guard-secrets.mjs', { tool_input: { file_path: '/p/a.ts', edits: [{ new_string: PEM }] } }).status, 2);
  assert.equal(run('guard-secrets.mjs', null, 'not json').status, 0);
});

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'wshook-'));
  for (const [rel, src] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, src);
  }
  return root;
}
const post = (root, rel) =>
  run('post-api-guard.mjs', { cwd: root, tool_name: 'Edit', tool_input: { file_path: join(root, rel).replace(/\\/g, '/') } }, undefined, root);

const GOOD = {
  'apps/api/src/app.module.ts': '@Module({ providers: [{ provide: APP_GUARD, useClass: G }] }) export class AppModule {}',
  'apps/api/src/main.ts': 'app.useGlobalPipes(new ValidationPipe({ whitelist: true }));',
  'apps/api/src/boards.controller.ts': "@Controller('boards') export class BoardsController { @Get() list() {} }",
};

test('post-api-guard: ignores other files and paths outside apps/api/src', () => {
  const root = project({ ...GOOD, 'apps/api/src/util.ts': 'export const x = 1;', 'apps/web/src/a.controller.ts': 'x' });
  assert.equal(post(root, 'apps/api/src/util.ts').status, 0);
  assert.equal(post(root, 'apps/web/src/a.controller.ts').status, 0);
  rmSync(root, { recursive: true, force: true });
});

test('post-api-guard: clean API passes; missing global guard exits 2 with the finding', () => {
  const good = project(GOOD);
  assert.equal(post(good, 'apps/api/src/boards.controller.ts').status, 0);

  const bad = project({ ...GOOD, 'apps/api/src/app.module.ts': '@Module({}) export class AppModule {}' });
  const r = post(bad, 'apps/api/src/boards.controller.ts');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /A1/);
  assert.match(r.stderr, /Do not weaken the lint/);
  [good, bad].forEach((d) => rmSync(d, { recursive: true, force: true }));
});

test('post-api-guard: prefers the project scripts/authz-guard.mjs over the bundled copy', () => {
  const root = project({ ...GOOD, 'scripts/authz-guard.mjs': 'console.error("LOCAL LINT RAN"); process.exit(1);' });
  const r = post(root, 'apps/api/src/boards.controller.ts');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /LOCAL LINT RAN/);
  rmSync(root, { recursive: true, force: true });
});
