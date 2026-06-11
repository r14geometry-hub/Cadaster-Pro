import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    singleFork: true,
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
  },
});
