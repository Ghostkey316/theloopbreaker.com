import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": root,
      "@/constants": path.resolve(root, "constants"),
      "@/lib": path.resolve(root, "lib"),
      "@/components": path.resolve(root, "components"),
      "@/hooks": path.resolve(root, "hooks"),
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
