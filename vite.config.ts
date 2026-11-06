import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: [
      "3000-i3xvbfamyz258eb6k7l74-bee21904.us3.manus.computer",
      "8328-i3xvbfamyz258eb6k7l74-bee21904.us3.manus.computer",
    ],
  },
});
