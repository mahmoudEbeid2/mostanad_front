import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Render tests (UI plan, Phase A §4): no CSS, no network — every API call answers empty.
export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
    testTimeout: 30000,
    css: false,
  },
});
