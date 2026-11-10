import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: projectRoot,
  base: "./",
  define: { "import.meta.env.VITE_OPERADASH_EXTENSION": JSON.stringify("1") },
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "dist-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(projectRoot, "index.html"),
        background: resolve(projectRoot, "src/extension/background.ts"),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
