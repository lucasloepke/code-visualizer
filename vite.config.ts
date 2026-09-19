import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The side panel is a normal extension HTML page. We build only it with Vite;
// the content script, page bridge, and background service worker are bundled
// separately with esbuild (see scripts/build.mjs) so they get stable,
// unhashed filenames that the manifest can reference.
export default defineConfig({
  root: fileURLToPath(new URL("./src/sidepanel", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: false, // build.mjs owns emptying dist so it can also copy assets
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep asset names predictable-ish; hashing is fine for the panel
        // because index.html references them directly.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
