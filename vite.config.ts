import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  // Relative paths work on the standalone Netlify site
  // and later when proxied through /challenge/
  base: "./",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/app/challenge": path.resolve(__dirname, "./src/challenge")
    }
  },

  build: {
    outDir: "dist"
  }
});