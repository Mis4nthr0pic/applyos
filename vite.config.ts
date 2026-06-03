import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const contentEntry = resolve(rootDir, "src/content/index.ts");
const contentOutput = resolve(rootDir, "dist/assets/content.js");

async function buildContentScriptIife(): Promise<void> {
  await viteBuild({
    configFile: false,
    build: {
      outDir: resolve(rootDir, "dist"),
      emptyOutDir: false,
      copyPublicDir: false,
      lib: {
        entry: contentEntry,
        name: "ApplyOSContent",
        formats: ["iife"],
        fileName: () => "assets/content.js"
      },
      rollupOptions: {
        output: {
          extend: true,
          inlineDynamicImports: true
        }
      }
    }
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "applyos-content-iife",
      async closeBundle() {
        await buildContentScriptIife();
      }
    }
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(rootDir, "sidepanel.html"),
        background: resolve(rootDir, "src/background/index.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
