#!/usr/bin/env node

const net = require("node:net");
const { execSync } = require("node:child_process");
const {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  readFileSync,
} = require("node:fs");
const { resolve, join } = require("node:path");

const rootDir = resolve(__dirname, "..");
const EXTENSION_ID = "loggy@devtools-extension";
const DIST_DIR = join(rootDir, "dist-firefox");
const XPI_NAME = "loggy-firefox.xpi";
const RDP_HOST = "127.0.0.1";
const RDP_PORT = 6000;

// --- Helpers ---

function run(cmd, opts = {}) {
  console.log(`\n  > ${cmd}\n`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: rootDir, ...opts });
  } catch {
    fail(`Command failed: ${cmd}`);
  }
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function logStep(step, msg) {
  console.log(`\n${step}  ${msg}`);
  console.log("─".repeat(50));
}

// --- RDP Client (matches web-ext's rdp-client.js protocol) ---

function createRDPClient(port) {
  const pending = new Map();
  let buffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: RDP_HOST });
    socket.setTimeout(10000); // 10s socket timeout
    let initialized = false;

    socket.on("error", (err) => {
      if (!initialized) reject(err);
      else {
        console.error(`  RDP connection error: ${err.message}`);
        socket.destroy();
      }
    });

    socket.on("timeout", () => {
      const msg = "RDP socket timeout (no data from Firefox)";
      if (!initialized) reject(new Error(msg));
      else {
        console.error(`  ${msg}`);
        socket.destroy();
      }
    });

    socket.on("end", () => {
      for (const [, rej] of pending.values()) rej(new Error("RDP connection closed"));
      pending.clear();
    });

    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length > 0) {
        const sepIdx = buffer.indexOf(58); // ':'
        if (sepIdx < 0) break;

        const byteLen = Number.parseInt(buffer.slice(0, sepIdx).toString());
        if (Number.isNaN(byteLen)) break;

        const msgStart = sepIdx + 1;
        if (buffer.length - msgStart < byteLen) break;

        const msg = buffer.slice(msgStart, msgStart + byteLen);
        buffer = buffer.slice(msgStart + byteLen);

        try {
          const parsed = JSON.parse(msg.toString());
          handleRDPMessage(parsed);
        } catch {
          // skip malformed
        }
      }
    });

    function handleRDPMessage(msg) {
      if (!initialized) {
        // First message is the root actor greeting
        initialized = true;
        resolve({ request, disconnect });
        return;
      }

      if (msg.from && pending.has(msg.from)) {
        const [res, rej] = pending.get(msg.from);
        pending.delete(msg.from);
        if (msg.error) {
          rej(new Error(`${msg.error}: ${msg.message}`));
        } else {
          res(msg);
        }
      }
    }

    function request(props) {
      const req = typeof props === "string" ? { to: "root", type: props } : props;
      return new Promise((res, rej) => {
        pending.set(req.to, [res, rej]);
        const str = JSON.stringify(req);
        const framed = `${Buffer.from(str).length}:${str}`;
        socket.write(framed);
      });
    }

    function disconnect() {
      socket.end();
    }
  });
}

// --- Remote install via RDP ---

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms),
    ),
  ]);
}

async function remoteInstall(port) {
  const RDP_TIMEOUT = 10000; // 10s for connection + getRoot + install
  logStep("🔌", `Connecting to Firefox RDP on port ${port}`);
  let client;
  try {
    client = await withTimeout(
      createRDPClient(port),
      RDP_TIMEOUT,
      "RDP connection",
    );
  } catch (err) {
    console.log(`  RDP connection failed: ${err.message}`);
    console.log(
      "  Note: Firefox 130+ uses WebDriver BiDi (WebSocket), not plain TCP RDP.",
    );
    console.log("  Falling back to XPI profile copy.\n");
    return false;
  }

  try {
    // Step 1: Get the addons actor
    const root = await withTimeout(
      client.request("getRoot"),
      RDP_TIMEOUT,
      "getRoot request",
    );
    if (!root.addonsActor) {
      console.error("  Firefox does not expose addonsActor. Is this Firefox 49+?");
      return false;
    }

    // Step 2: Install the temporary addon from the built directory
    const absPath = resolve(DIST_DIR);
    const result = await withTimeout(
      client.request({
        to: root.addonsActor,
        type: "installTemporaryAddon",
        addonPath: absPath,
      }),
      RDP_TIMEOUT,
      "installTemporaryAddon request",
    );

    client.disconnect();

    if (result.error) {
      console.error(`  Install failed: ${result.error}: ${result.message}`);
      return false;
    }

    logStep("✅", "Extension installed via Remote Debugging Protocol");
    console.log(`  No restart needed — the extension is live.\n`);
    return true;
  } catch (err) {
    console.error(`  RDP install failed: ${err.message}`);
    try { client.disconnect(); } catch {}
    return false;
  }
}

// --- Profile discovery (fallback: XPI copy) ---

function getFirefoxDevEditionProfile() {
  const iniPath = resolve(
    process.env.HOME || process.env.USERPROFILE,
    ".mozilla/firefox/profiles.ini",
  );

  if (!existsSync(iniPath)) {
    fail(
      "profiles.ini not found at ~/.mozilla/firefox/profiles.ini. Is Firefox installed?",
    );
  }

  const raw = readFileSync(iniPath, "utf8");

  const sections = {};
  let current = null;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      current = trimmed.slice(1, -1);
      sections[current] = {};
    } else if (current && trimmed.includes("=")) {
      const eq = trimmed.indexOf("=");
      sections[current][trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim();
    }
  }

  for (const [, section] of Object.entries(sections)) {
    if (section.Default === "1" && section.Path) {
      const name = (section.Name || "").toLowerCase();
      if (name.includes("dev") || name.includes("edition")) {
        return resolve(process.env.HOME, ".mozilla/firefox", section.Path);
      }
    }
  }

  for (const [, section] of Object.entries(sections)) {
    if (section.Path) {
      const path = section.Path.toLowerCase();
      if (path.includes("dev") || path.includes("edition")) {
        return resolve(process.env.HOME, ".mozilla/firefox", section.Path);
      }
    }
  }

  const firefoxDir = resolve(process.env.HOME, ".mozilla/firefox");
  if (existsSync(firefoxDir)) {
    const match = readdirSync(firefoxDir).find((d) =>
      d.endsWith(".dev-edition-default"),
    );
    if (match) return resolve(firefoxDir, match);
  }

  fail(
    "Could not find Firefox Developer Edition profile. Open about:profiles in Firefox to check.",
  );
}

function copyXpiToProfile() {
  const profilePath = process.argv.includes("--profile")
    ? resolve(process.argv[process.argv.indexOf("--profile") + 1])
    : getFirefoxDevEditionProfile();

  if (!existsSync(profilePath)) fail(`Profile not found: ${profilePath}`);

  const xpiPath = join(rootDir, XPI_NAME);
  if (!existsSync(xpiPath)) fail(`XPI not found: ${xpiPath}`);

  const extensionsDir = join(profilePath, "extensions");
  if (!existsSync(extensionsDir)) mkdirSync(extensionsDir, { recursive: true });

  const destPath = join(extensionsDir, `${EXTENSION_ID}.xpi`);
  copyFileSync(xpiPath, destPath);
  console.log(`  Copied XPI to: ${destPath}`);
  console.log("\n  Restart Firefox to load the extension.");
  console.log(
    "  Make sure xpinstall.signatures.required = false in about:config.\n",
  );
}

// --- Main ---

async function main() {
  const portIdx = process.argv.indexOf("--port");
  const port = portIdx > -1 ? Number.parseInt(process.argv[portIdx + 1]) : RDP_PORT;

  // Step 1: Build
  logStep("🔨", "Building Firefox extension");
  run("npm run build:firefox");

  if (!existsSync(DIST_DIR)) fail(`Build output not found: ${DIST_DIR}`);

  // Step 2: Try remote install (live, no restart)
  const installed = await remoteInstall(port);

  if (!installed) {
    // Step 3: Fallback — package XPI and copy to profile
    logStep("📦", "Remote install unavailable — falling back to XPI copy");
    run(`rm -f ${XPI_NAME} && (cd ${DIST_DIR} && zip -r ../${XPI_NAME} .)`);
    copyXpiToProfile();
  }
}

main();
