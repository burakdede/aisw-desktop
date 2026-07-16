import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  define: {
    __BUNDLED_DEV__: "false",
    __SERVER_FORWARD_CONSOLE__: "false",
  },
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/assets/**",
        "src/main.tsx",
        "src/test/**",
        "**/*.test.{ts,tsx}",
      ],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 75,
        branches: 75,
      },
    },
  },
});
