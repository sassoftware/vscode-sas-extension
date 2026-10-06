import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["client/test/**/*.test.tsx"],
    setupFiles: ["./client/test/react/setup.ts"],
  },
});
