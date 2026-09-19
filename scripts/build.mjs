// Build orchestrator for the LeetVision MV3 extension.
//
// Steps:
//   1. Empty dist/
//   2. Build the React side panel with Vite  -> dist/index.html + dist/assets/*
//   3. Bundle content script, page bridge, and service worker with esbuild
//      -> dist/content.js, dist/page-bridge.js, dist/background.js
//   4. Copy manifest.json -> dist/manifest.json
//   5. Copy the locally-installed Pyodide runtime -> dist/pyodide/*  (this is
//      the "bundle Pyodide at build time" step -- MV3 CSP forbids fetching it
//      from a CDN at runtime, so it must ship inside the package)
//   6. Generate placeholder icons -> dist/icons/*
//
// Usage: node scripts/build.mjs [--watch]

import { build as viteBuild } from "vite";
import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");

/** Files we need from the Pyodide npm package. The rest (docs, maps) are skipped. */
const PYODIDE_FILES = [
  "pyodide.mjs",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

function log(...args) {
  console.log("[build]", ...args);
}

function emptyDist() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
}

async function buildSidePanel() {
  log("building side panel (vite)...");
  await viteBuild({ configFile: resolve(root, "vite.config.ts") });
}

async function buildScripts() {
  log("bundling content / page-bridge / background (esbuild)...");
  const common = {
    bundle: true,
    target: "es2022",
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
  };

  const jobs = [
    {
      entryPoints: [resolve(root, "src/content/index.ts")],
      outfile: resolve(dist, "content.js"),
      format: "iife",
    },
    {
      entryPoints: [resolve(root, "src/content/page-bridge.ts")],
      outfile: resolve(dist, "page-bridge.js"),
      format: "iife",
    },
    {
      entryPoints: [resolve(root, "src/background.ts")],
      outfile: resolve(dist, "background.js"),
      format: "esm",
    },
  ];

  if (watch) {
    for (const job of jobs) {
      const ctx = await esbuild.context({ ...common, ...job });
      await ctx.watch();
    }
  } else {
    await Promise.all(jobs.map((job) => esbuild.build({ ...common, ...job })));
  }
}

function copyManifest() {
  fs.copyFileSync(resolve(root, "src/manifest.json"), resolve(dist, "manifest.json"));
}

function copyPyodide() {
  log("copying bundled Pyodide runtime...");
  const src = resolve(root, "node_modules/pyodide");
  const out = resolve(dist, "pyodide");
  fs.mkdirSync(out, { recursive: true });
  for (const f of PYODIDE_FILES) {
    const from = join(src, f);
    if (!fs.existsSync(from)) {
      throw new Error(
        `Pyodide file missing: ${from}. Did 'npm install' run? (pyodide is a devDependency)`,
      );
    }
    fs.copyFileSync(from, join(out, f));
  }
}

// ---- Minimal PNG encoder (solid-color square) so the manifest icons resolve
// without shipping binary assets in the repo. -----------------------------
function makePng(size, [r, g, b]) {
  const bytesPerPixel = 3;
  const rowLen = size * bytesPerPixel + 1; // +1 filter byte per row
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const o = y * rowLen + 1 + x * bytesPerPixel;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  // 10,11,12 = compression, filter, interlace = 0

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function writeIcons() {
  const out = resolve(dist, "icons");
  fs.mkdirSync(out, { recursive: true });
  const color = [99, 102, 241]; // indigo-500
  for (const size of [16, 48, 128]) {
    fs.writeFileSync(join(out, `icon${size}.png`), makePng(size, color));
  }
}

async function run() {
  emptyDist();
  await buildSidePanel();
  await buildScripts();
  copyManifest();
  copyPyodide();
  writeIcons();
  log(`done -> ${dist}`);
  if (watch) {
    log("watching content/background scripts. Re-run vite build manually for panel changes.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
