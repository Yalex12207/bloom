import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default defineConfig([
  globalIgnores([".next/**", "out/**", "node_modules/**", "artifacts/**", "next-env.d.ts"]),
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      nextPlugin.configs["core-web-vitals"],
    ],
  },
]);
