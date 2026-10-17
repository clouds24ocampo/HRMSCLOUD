// `npm run dev`: start everything the system needs, then the app.
//   npm run dev            database + app on http://localhost:3300 & Wi-Fi IP
//   npm run dev:phone      the same, plus a secure phone link (for GPS testing on a real phone)
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import QRCode from "qrcode";
import { ensureAll } from "./ensure-db.mjs";

const PORT = 3300;
const withTunnel = process.argv.includes("--tunnel");
const say = (m) => console.log(`[hrms] ${m}`);

function getLocalIps() {
  const nets = networkInterfaces();
  const list = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Pick IPv4 non-internal addresses (e.g. 192.168.x.x, 10.x.x.x)
      if (net.family === "IPv4" && !net.internal) {
        // Exclude virtual/Hyper-V/WSL host-only adapters if possible
        const isVirtual = /wsl|virtual|vethernet|hyper-v/i.test(name);
        list.push({ name, ip: net.address, isVirtual });
      }
    }
  }
  // Sort so physical Wi-Fi / Ethernet comes first
  return list.sort((a, b) => (a.isVirtual ? 1 : 0) - (b.isVirtual ? 1 : 0));
}

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
  const localIps = getLocalIps();
  const wifiIp = localIps[0]?.ip;
  say(`The app is already running!`);
  say(`- Local: http://localhost:${PORT}`);
  if (wifiIp) {
    say(`- Mobile / Wi-Fi: http://${wifiIp}:${PORT}`);
  }
  process.exit(0);
}

// The port can be held by an old server that no longer answers (e.g. a frozen dev server).
// Starting another one would fail with EADDRINUSE, so explain how to fix it instead.
async function portBusy() {
  const { createServer } = await import("node:net");
  return new Promise((resolve) => {
    const srv = createServer()
      .once("error", () => resolve(true))
      .once("listening", () => srv.close(() => resolve(false)))
      .listen(PORT, "0.0.0.0");
  });
}

if (await portBusy()) {
  say(`Port ${PORT} is taken by another program that is not answering (probably an old, frozen server).`);
  if (process.platform === "win32") {
    say(`Stop it with:  Get-NetTCPConnection -LocalPort ${PORT} -State Listen | % { taskkill /pid $_.OwningProcess /t /f }`);
  } else {
    say(`Stop it with:  kill $(lsof -t -i:${PORT})`);
  }
  say(`Then run "npm run dev" again.`);
  process.exit(1);
}

await ensureAll();

const localIps = getLocalIps();
const primaryIp = localIps[0]?.ip;
if (primaryIp && !process.env.APP_URL) {
  process.env.APP_URL = `http://${primaryIp}:${PORT}`;
}

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

console.log("\n=======================================================");
say(`🚀 HRMS Server is starting on port ${PORT}...`);
say(`💻 Local Computer:  http://localhost:${PORT}`);
if (primaryIp) {
  const phoneUrl = `http://${primaryIp}:${PORT}`;
  say(`📱 Mobile / Wi-Fi:   ${phoneUrl}`);
  say(`💡 Ensure your mobile phone is connected to the same Wi-Fi.`);
  try {
    const qrString = await QRCode.toString(phoneUrl, { type: "terminal", small: true });
    console.log("\nScan to open on your mobile phone:");
    console.log(qrString);
  } catch {
    // QR code is optional in terminal
  }
}
console.log("=======================================================\n");

// -H 0.0.0.0 binds Next.js to all network interfaces so Wi-Fi devices can connect
const next = spawn(`npx next dev -H 0.0.0.0 -p ${PORT}`, { stdio: "inherit", shell: true });
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
      say(`Phone link (HTTPS, needed for native GPS): ${m[0]}`);
      say("Anyone with this link can open the app while it runs. Close this window when you are done.");
    }
  };
  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);
  tunnel.on("error", () => say("Could not start the phone tunnel. Install it with: winget install Cloudflare.cloudflared"));
}
