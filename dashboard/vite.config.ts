import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const LOCAL_MACHINE_DASHBOARD_DATA_PATH =
  "/Users/rami/Documents/life-os/network/luma-enricher/dashboard/src/data/dashboard.json";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // prod builds should always read Rami's local dashboard export.
      "dashboard-data-source":
        mode === "production"
          ? LOCAL_MACHINE_DASHBOARD_DATA_PATH
          : resolve(import.meta.dirname, "src/data/dashboard.json"),
    },
  },
}));
