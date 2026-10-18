// Tests for scripts/authz-guard.mjs.  Run: node --test scripts/authz-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan } from './authz-guard.mjs';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'authz-guard.mjs');

/** files: { 'apps/api/src/x.ts': 'source', 'docs/security/public-routes.json': '[...]' } */
function project(files) {
  const base = mkdtempSync(join(tmpdir(), 'authz-'));
  for (const [rel, src] of Object.entries(files)) {
    const p = join(base, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, src);
  }
  return base;
}
const run = (base) => scan(join(base, 'apps/api/src'), { base });
const rules = (r) => r.failures.map((f) => f.rule).sort();
const done = (b) => rmSync(b, { recursive: true, force: true });

const APP = `
import { APP_GUARD } from '@nestjs/core';
@Module({ providers: [{ provide: APP_GUARD, useClass: AuthGuard }] })
export class AppModule {}`;
const MAIN = `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));`;
const CTRL = `@Controller('boards')\nexport class BoardsController {\n  @Get()\n  list() {}\n}`;
const BASE = { 'apps/api/src/app.module.ts': APP, 'apps/api/src/main.ts': MAIN, 'apps/api/src/boards.controller.ts': CTRL };

test('clean project passes', () => {
  const b = project(BASE);
  const r = run(b);
  assert.equal(r.passed, true, JSON.stringify(r.failures));
  assert.equal(r.scanned, 3);
  done(b);
});

test('A1: controller without a global guard fails', () => {
  const b = project({ ...BASE, 'apps/api/src/app.module.ts': '@Module({}) export class AppModule {}' });
  assert.deepEqual(rules(run(b)), ['A1']);
  done(b);
});

test('A4: missing or non-whitelisting ValidationPipe fails', () => {
  const none = project({ ...BASE, 'apps/api/src/main.ts': 'bootstrap();' });
  assert.deepEqual(rules(run(none)), ['A4']);
  const weak = project({ ...BASE, 'apps/api/src/main.ts': 'app.useGlobalPipes(new ValidationPipe({ transform: true }));' });
  assert.deepEqual(rules(run(weak)), ['A4']);
  [none, weak].forEach(done);
});

test('A2: @Public must be allow-listed with a reason and an ADR', () => {
  const ctrl = `@Controller('health')\nexport class HealthController {\n  @Public()\n  @Get()\n  async ping() {}\n}`;
  const files = { ...BASE, 'apps/api/src/health.controller.ts': ctrl };

  const unlisted = project(files);
  const r1 = run(unlisted);
  assert.deepEqual(rules(r1), ['A2']);
  assert.equal(r1.failures[0].line, 3);
  assert.deepEqual(r1.publicUsages, [{ file: 'apps/api/src/health.controller.ts', handler: 'ping', line: 3 }]);

  const ok = project({ ...files, 'docs/security/public-routes.json': JSON.stringify([{ file: 'apps/api/src/health.controller.ts', handler: 'ping', reason: 'liveness probe for the load balancer', adr: 'ADR-007' }]) });
  assert.equal(run(ok).passed, true);

  const noAdr = project({ ...files, 'docs/security/public-routes.json': JSON.stringify([{ file: 'apps/api/src/health.controller.ts', handler: 'ping', reason: 'liveness probe' }]) });
  assert.deepEqual(rules(run(noAdr)), ['A2']);

  const stale = project({ ...BASE, 'docs/security/public-routes.json': JSON.stringify([{ file: 'gone.ts', handler: 'x', reason: 'old reason text', adr: 'ADR-001' }]) });
  const r4 = run(stale);
  assert.equal(r4.passed, true);
  assert.match(r4.warnings[0], /stale/);
  [unlisted, ok, noAdr, stale].forEach(done);
});

test('A2: class-level @Public is matched by class name; other decorator names count', () => {
  const ctrl = `@Public()\n@Controller('form')\nexport class FormController {}\n@SkipAuth()\n@Controller('x')\nexport class XController {}`;
  const b = project({ ...BASE, 'apps/api/src/form.controller.ts': ctrl });
  const r = run(b);
  assert.deepEqual(r.publicUsages.map((u) => u.handler), ['FormController', 'XController']);
  assert.deepEqual(rules(r), ['A2', 'A2']);
  done(b);
});

test('A2: @Public mentioned only in a comment is ignored; spec files are ignored', () => {
  const b = project({
    ...BASE,
    'apps/api/src/notes.ts': '// never use @Public() here\nexport const x = 1;',
    'apps/api/src/boards.controller.spec.ts': "@Public()\nclass T { run() {} }",
  });
  assert.equal(run(b).passed, true);
  done(b);
});

test('A3: gateway handlers need @UseGuards on the class or the handler', () => {
  const classLevel = `@UseGuards(WsAuthGuard)\n@WebSocketGateway()\nexport class G {\n  @SubscribeMessage('a') a() {}\n  @SubscribeMessage('b') b() {}\n}`;
  const ok1 = project({ ...BASE, 'apps/api/src/g.gateway.ts': classLevel });
  assert.equal(run(ok1).passed, true);

  const handlerLevel = `@WebSocketGateway()\nexport class G {\n  @UseGuards(WsAuthGuard)\n  @SubscribeMessage('a')\n  a() {}\n}`;
  const ok2 = project({ ...BASE, 'apps/api/src/g.gateway.ts': handlerLevel });
  assert.equal(run(ok2).passed, true);

  const mixed = `@WebSocketGateway()\nexport class G {\n  @UseGuards(WsAuthGuard)\n  @SubscribeMessage('a')\n  a() {}\n\n  @SubscribeMessage('b')\n  b(@MessageBody() d: { x: string }) {}\n}`;
  const bad = project({ ...BASE, 'apps/api/src/g.gateway.ts': mixed });
  const r = run(bad);
  assert.deepEqual(rules(r), ['A3']);
  assert.match(r.failures[0].message, /"b"/);
  [ok1, ok2, bad].forEach(done);
});

test('no controllers: global guard and pipe are not required', () => {
  const b = project({ 'apps/api/src/util.ts': 'export const add = (a: number, b: number) => a + b;' });
  assert.equal(run(b).passed, true);
  done(b);
});

test('CLI: missing folder passes, --require-root fails with 2; --json parses; bad allow-list exits 2', () => {
  const b = project(BASE);
  const missing = join(b, 'nope');
  assert.equal(spawnSync(process.execPath, [GUARD, missing], { encoding: 'utf8', cwd: b }).status, 0);
  assert.equal(spawnSync(process.execPath, [GUARD, missing, '--require-root'], { encoding: 'utf8', cwd: b }).status, 2);

  const bad = project({ ...BASE, 'apps/api/src/app.module.ts': '@Module({}) export class AppModule {}' });
  const j = spawnSync(process.execPath, [GUARD, 'apps/api/src', '--json'], { encoding: 'utf8', cwd: bad });
  assert.equal(j.status, 1);
  assert.equal(JSON.parse(j.stdout).failures[0].rule, 'A1');

  const broken = project({ ...BASE, 'docs/security/public-routes.json': '{not json' });
  assert.equal(spawnSync(process.execPath, [GUARD, 'apps/api/src'], { encoding: 'utf8', cwd: broken }).status, 2);
  [b, bad, broken].forEach(done);
});
