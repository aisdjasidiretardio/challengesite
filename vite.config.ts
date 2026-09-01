import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  // IMPORTANT:
  // Challenge will ultimately appear at yourdomain.com/challenge/
  base: "/challenge/",

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
