import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Levantar Postgres (PGlite) la primera vez en cada archivo tarda unos segundos.
    hookTimeout: 60_000,
  },
});
