import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En GitHub Pages el sitio vive en /<nombre-del-repo>/
export default defineConfig({
  base: "/Islas_de_Calor/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
});
