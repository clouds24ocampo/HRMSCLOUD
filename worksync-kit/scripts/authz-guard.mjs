#!/usr/bin/env node
// Authorization lint for the WorkSync NestJS API (rule Z-1: deny by default).
//
// ONE signal, not proof. It cannot see dynamic registration, custom decorators with other
// names, or logic inside a handler. Real assurance comes from the authz test matrix
// (skill authz-test-matrix), review, and a pen-test.
//
// Rules (TypeScript files under the API source folder, comments stripped, *.spec/*.test ignored):
//  A1  If any @Controller exists, a global guard must be registered (an APP_GUARD provider).
//  A2  Every @Public() (or @SkipAuth/@AllowAnonymous) must be listed in the allow-list
//      docs/security/public-routes.json as {file, handler, reason (10+ chars), adr: "ADR-NNN"}.
//      Stale allow-list entries are reported as warnings.
//  A3  Every @SubscribeMessage handler must be covered by @UseGuards(...) on its class or on
//      the handler. (Conservative: we do not assume global guards cover WebSocket gateways.)
//  A4  If any @Controller exists, a ValidationPipe with whitelist: true must be configured
//      (blocks mass assignment).
//
// Usage: node scripts/authz-guard.mjs [apiSrcDir] [--json] [--require-root] [--allowlist path]
//   apiSrcDir   default: apps/api/src
// Exit codes: 0 pass (or nothing to scan), 1 findings, 2 usage/config error.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const TEST_FILE = /\.(spec|test|e2e-spec)\.ts$/;
const PUBLIC_RE = /@(?:Public|SkipAuth|AllowAnonymous)\b/g;

export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '');
}
const lineOf = (text, i) => text.slice(0, i).split('\n').length;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !TEST_FILE.test(name)) {
      yield p;
    }
  }
}

/** Skip any run of decorators (with balanced parentheses) starting at i. */
function skipDecorators(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== '@') return i;
    i++;
    while (i < text.length && /[\w.]/.test(text[i])) i++;
    let j = i;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] === '(') {
      let depth = 0;
      for (i = j; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) {
          i++;
          break;
        }
      }
    }
  }
}

/** Name of the class or method a decorator at `afterIndex` belongs to. */
function targetName(text, afterIndex) {
  const rest = text.slice(skipDecorators(text, afterIndex), skipDecorators(text, afterIndex) + 200);
  const cls = rest.match(/^(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/);
  if (cls) return cls[1];
  const method = rest.match(/^(?:(?:public|private|protected|static|async)\s+)*(\w+)\s*[(<]/);
  return method ? method[1] : '(unknown)';
}

/**
 * @param {string} root API source folder
 * @param {{base?:string, allowlistPath?:string}} [opts] base: folder that file paths are shown relative to
 */
export function scan(root, opts = {}) {
  const base = resolve(opts.base ?? process.cwd());
  const absRoot = resolve(root);
  const allowlistPath = resolve(base, opts.allowlistPath ?? 'docs/security/public-routes.json');
  const result = { root, rootMissing: false, scanned: 0, passed: true, failures: [], warnings: [], publicUsages: [] };
  if (!existsSync(absRoot)) {
    result.rootMissing = true;
    return result;
  }

  let allowlist = [];
  if (existsSync(allowlistPath)) {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    if (!Array.isArray(allowlist)) throw new Error(`${allowlistPath} must be a JSON array`);
  }

  const files = [...walk(absRoot)].map((path) => {
    const code = stripComments(readFileSync(path, 'utf8'));
    return { path, rel: relative(base, path).split('\\').join('/'), code };
  });
  result.scanned = files.length;
  const fail = (f, idx, rule, message) =>
    result.failures.push({ file: f.rel, path: f.path, line: lineOf(f.code, idx), rule, message });

  let firstController = null;
  let hasGlobalGuard = false;
  let hasWhitelistPipe = false;

  for (const f of files) {
    const { code } = f;
    if (/\bAPP_GUARD\b/.test(code)) hasGlobalGuard = true;
    if (/ValidationPipe[\s\S]{0,300}?whitelist\s*:\s*true/.test(code)) hasWhitelistPipe = true;

    const ctrl = code.search(/@Controller\s*\(/);
    if (ctrl !== -1 && !firstController) firstController = { f, idx: ctrl };

    // A2: public routes
    for (const m of code.matchAll(PUBLIC_RE)) {
      result.publicUsages.push({ file: f.rel, handler: targetName(code, m.index), line: lineOf(code, m.index), f, idx: m.index });
    }

    // A3: gateway handlers
    const gw = code.search(/@WebSocketGateway\b/);
    if (gw !== -1) {
      const classIdx = code.indexOf('class ', gw);
      const classRegionStart = Math.max(code.lastIndexOf('}', gw), 0);
      const classGuarded = classIdx !== -1 && code.slice(classRegionStart, classIdx).includes('@UseGuards(');
      for (const m of code.matchAll(/@SubscribeMessage\s*\(/g)) {
        if (classGuarded) continue;
        const start = Math.max(code.lastIndexOf('}', m.index), code.lastIndexOf('{', m.index), code.lastIndexOf(';', m.index), 0);
        const end = code.indexOf('{', m.index);
        const region = code.slice(start, end === -1 ? code.length : end);
        if (!region.includes('@UseGuards(')) {
          fail(f, m.index, 'A3', `WebSocket handler "${targetName(code, m.index)}" has no @UseGuards on the handler or its class`);
        }
      }
    }
  }

  // A2 evaluation
  const used = new Set();
  for (const u of result.publicUsages) {
    const entry = allowlist.find((e) => e.file === u.file && e.handler === u.handler);
    if (!entry) {
      fail(u.f, u.idx, 'A2', `@Public on "${u.handler}" is not in the allow-list (add it with a reason and an ADR, or remove it)`);
      continue;
    }
    used.add(entry);
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 10 || !/^ADR-\d+$/.test(String(entry.adr ?? ''))) {
      fail(u.f, u.idx, 'A2', `allow-list entry for "${u.handler}" needs a reason (10+ chars) and an adr like "ADR-007"`);
    }
  }
  for (const e of allowlist) if (!used.has(e)) result.warnings.push(`stale allow-list entry: ${e.file} ${e.handler}`);
  result.publicUsages = result.publicUsages.map(({ file, handler, line }) => ({ file, handler, line }));

  // A1 and A4
  if (firstController) {
    if (!hasGlobalGuard) fail(firstController.f, firstController.idx, 'A1', 'controllers exist but no global guard (APP_GUARD) is registered (rule Z-1)');
    if (!hasWhitelistPipe) fail(firstController.f, firstController.idx, 'A4', 'controllers exist but no ValidationPipe with whitelist: true is configured');
  }

  result.passed = result.failures.length === 0;
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const requireRoot = args.includes('--require-root');
  const ai = args.indexOf('--allowlist');
  const allowlistPath = ai !== -1 ? args[ai + 1] : undefined;
  const allowlistValueIndex = ai === -1 ? -1 : ai + 1;
  const root = args.find((a, i) => !a.startsWith('--') && i !== allowlistValueIndex) ?? 'apps/api/src';

  let result;
  try {
    result = scan(root, { allowlistPath });
  } catch (e) {
    console.error(`authz-guard: ${e.message}`);
    process.exit(2);
  }

  if (result.rootMissing && requireRoot) {
    const msg = `authz-guard: ${root} not found and --require-root was set`;
    if (json) console.log(JSON.stringify({ ...result, passed: false, error: msg }));
    else console.error(msg);
    process.exit(2);
  }
  if (json) {
    console.log(JSON.stringify(result));
    process.exit(result.passed ? 0 : 1);
  }
  if (result.rootMissing) {
    console.log(`authz-guard: ${root} not present yet - nothing to scan (ok before W1).`);
    process.exit(0);
  }
  console.log(`authz-guard: scanned ${result.scanned} file(s) under ${root}; ${result.publicUsages.length} public route(s)`);
  for (const w of result.warnings) console.log(`  WARN    ${w}`);
  if (!result.passed) {
    for (const f of result.failures) console.error(`  FAIL    ${f.file}:${f.line}: [${f.rule}] ${f.message}`);
    console.error('authz-guard: FAILED. See .agents/skills/permission-model-review/SKILL.md');
    process.exit(1);
  }
  console.log('authz-guard: passed (structural signal only; the authz test matrix and review are still required).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
