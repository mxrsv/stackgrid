import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL("./index.html", import.meta.url)),
        prototype: fileURLToPath(
          new URL("./landing-prototype/index.html", import.meta.url),
        ),
      },
    },
  },
});
