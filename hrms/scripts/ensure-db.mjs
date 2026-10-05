// Everything the system needs before the app can run. Used by `npm run dev` (scripts/dev.mjs) and `npm run db:up`.
//   1. .env exists            2. Docker is running        3. the Postgres container is up and accepts logins
//   4. migrations applied     5. database client matches the schema        6. roles exist (registration needs them)
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`[hrms] ${m}`);
const fail = (m) => {
  console.error(`[hrms] ${m}`);
  process.exit(1);
};
const line = (cmd, args) => [cmd, ...args].join(" ");
const run = (cmd, args, opts = {}) => spawnSync(line(cmd, args), { stdio: "inherit", shell: true, ...opts });

// 1. First run on a new machine: create .env with a fresh random database password.
function ensureEnv() {
  if (existsSync(".env")) return;
  if (!existsSync(".env.example")) fail(".env is missing and there is no .env.example to copy.");
  copyFileSync(".env.example", ".env");
  const password = randomBytes(16).toString("hex");
  const text = readFileSync(".env", "utf8").replaceAll("change-me", password);
  writeFileSync(".env", text);
  say("Created .env with a new database password.");
}

async function dbReady(pg, url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const dockerUp = () => spawnSync("docker info", { stdio: "ignore", shell: true }).status === 0;

async function waitFor(check, seconds, label) {
  const until = Date.now() + seconds * 1000;
  for (let i = 0; Date.now() < until; i++) {
    if (await check()) return true;
    if (i % 5 === 4) say(`waiting for ${label}…`);
    await sleep(1000);
  }
  return false;
}

export async function ensureAll() {
  ensureEnv();
  await import("dotenv/config");
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set in .env.");
  const pg = (await import("pg")).default;

  if (await dbReady(pg, url)) {
    say("Database is running.");
  } else {
    say("Database is not running. Starting it…");
    if (spawnSync("docker --version", { stdio: "ignore", shell: true }).status !== 0) fail("Docker is not installed. Install Docker Desktop, then run this again.");
    if (!dockerUp()) {
      say("Starting Docker Desktop (this takes up to a minute)…");
      const exe = [`${process.env.LOCALAPPDATA}\\Programs\\DockerDesktop\\Docker Desktop.exe`, "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"].find((p) => existsSync(p));
      if (process.platform === "win32" && exe) spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      if (!(await waitFor(async () => dockerUp(), 180, "Docker"))) fail("Docker did not start in time. Open Docker Desktop yourself, wait until it says it is running, then try again.");
    }
    if (run("docker", ["compose", "up", "-d"]).status !== 0) fail("`docker compose up -d` failed. Check the message above.");
    if (!(await waitFor(() => dbReady(pg, url), 90, "the database"))) fail("The database container is up but does not accept logins. Run `docker compose logs db` to see why.");
    say("Database is running.");
  }

  say("Applying migrations…");
  if (run("npx", ["prisma", "migrate", "deploy"]).status !== 0) fail("Migrations failed. See the message above.");
  say("Updating the database client…");
  if (run("npx", ["prisma", "generate"], { stdio: "ignore" }).status !== 0) fail("`prisma generate` failed. Run `npx prisma generate` to see why.");
  say("Making sure the roles exist…");
  if (run("npx", ["prisma", "db", "seed"], { stdio: "ignore" }).status !== 0) fail("Seeding the roles failed. Run `npx prisma db seed` to see why.");
}

// `node scripts/ensure-db.mjs` on its own.
if (import.meta.url === pathToFileURL(process.argv[1]).href) await ensureAll();
