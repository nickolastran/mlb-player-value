import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Plotly is one ~4.6MB chunk, loaded lazily by the charts.
  build: { chunkSizeWarningLimit: 5000 },
});
