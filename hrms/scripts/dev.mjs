// `npm run dev`: start everything the system needs, then the app.
//   npm run dev            database + app on http://localhost:3300
//   npm run dev:phone      the same, plus a secure phone link (for GPS testing on a real phone)
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { ensureAll } from "./ensure-db.mjs";

const PORT = 3300;
const withTunnel = process.argv.includes("--tunnel");
const say = (m) => console.log(`[hrms] ${m}`);

// Never start a second copy: two servers fight over the port and one of them breaks.
async function alreadyRunning() {
  try {
    const res = await fetch(`http://localhost:${PORT}/login`, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

if (await alreadyRunning()) {
  say(`The app is already running at http://localhost:${PORT}. Nothing to start.`);
  process.exit(0);
}

await ensureAll();

const children = [];
const stopAll = () => {
  for (const c of children) {
    if (c.killed || !c.pid) continue;
    // /t also ends the child processes that Next.js starts.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(c.pid), "/t", "/f"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
};
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("exit", stopAll);

say(`Starting the app on http://localhost:${PORT} …`);
const next = spawn(`npx next dev -p ${PORT}`, { stdio: "inherit", shell: true });
children.push(next);
next.on("exit", (code) => process.exit(code ?? 0));

if (withTunnel) {
  const candidates = ["cloudflared", "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe", "C:\\Program Files\\cloudflared\\cloudflared.exe"];
  const bin = candidates.find((c) => c === "cloudflared" || existsSync(c));
  const tunnel = spawn(`"${bin}" tunnel --url http://localhost:${PORT}`, { shell: true });
  children.push(tunnel);
  let shown = false;
  const watch = (buf) => {
    const m = !shown && /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf));
    if (m) {
      shown = true;
      say(`Phone link (HTTPS, needed for GPS): ${m[0]}`);
      say("Anyone with this link can open the app while it runs. Close this window when you are done.");
    }
  };
  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);
  tunnel.on("error", () => say("Could not start the phone tunnel. Install it with: winget install Cloudflare.cloudflared"));
}
