import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const LOCAL_MACHINE_DASHBOARD_DATA_PATH =
  "/Users/rami/Documents/life-os/network/luma-enricher/dashboard/src/data/dashboard.json";
const REPO_DASHBOARD_DATA_PATH = resolve(import.meta.dirname, "src/data/dashboard.json");

function getDashboardDataSource(mode: string): string {
  if (mode !== "production") {
    return REPO_DASHBOARD_DATA_PATH;
  }

  if (!existsSync(LOCAL_MACHINE_DASHBOARD_DATA_PATH)) {
    throw new Error(
      [
        "Production dashboard builds are configured to run only on Rami's machine.",
        `Expected local data file at: ${LOCAL_MACHINE_DASHBOARD_DATA_PATH}`,
        "If you are deploying to Vercel, build locally first, then deploy the prebuilt output:",
        "  bunx vercel build",
        "  bunx vercel deploy --prebuilt --prod",
      ].join("\n")
    );
  }

  return `/@fs/${normalizePath(LOCAL_MACHINE_DASHBOARD_DATA_PATH)}`;
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // prod builds should always read Rami's local dashboard export.
      "dashboard-data-source": getDashboardDataSource(mode),
    },
  },
}));
