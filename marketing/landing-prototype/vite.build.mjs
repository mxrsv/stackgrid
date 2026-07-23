import { resolve } from "node:path";
import { defineConfig } from "vite";

// Landing-only production build. Invoked exclusively via `--config`, so the
// `vite marketing` dev server never auto-loads it. Root = marketing so the
// index.html's absolute /landing-prototype/ asset URLs resolve.
export default defineConfig({
  root: resolve(import.meta.dirname, ".."),
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "index.html"),
    },
  },
});
