import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import playwright from "eslint-plugin-playwright";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ...playwright.configs["flat/recommended"],
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/no-element-handle": "error",
      "playwright/no-force-option": "error",
      "playwright/no-page-pause": "error",
      "playwright/no-wait-for-timeout": "error",
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
