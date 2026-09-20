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
//   6. Copy extension icons -> dist/icons/*
//
// Usage: node scripts/build.mjs [--watch]

import { build as viteBuild } from "vite";
import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import fs from "node:fs";

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

function writeIcons() {
  const srcDir = resolve(root, "src/icons");
  const out = resolve(dist, "icons");
  fs.mkdirSync(out, { recursive: true });
  for (const size of [16, 48, 128]) {
    const from = join(srcDir, `icon${size}.png`);
    if (!fs.existsSync(from)) {
      throw new Error(`Missing icon: ${from}. Expected src/icons/icon{16,48,128}.png`);
    }
    fs.copyFileSync(from, join(out, `icon${size}.png`));
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
