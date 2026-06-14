import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // Generated output and dependencies are never linted.
  {
    ignores: ["build/", ".react-router/", "node_modules/", "public/"],
  },

  // Base JavaScript + TypeScript rules for every source file.
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // React rules for component/route files.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
    ],
    settings: { react: { version: "detect" } },
  },

  // React Hooks rules. This plugin's shared config still uses the legacy
  // `plugins: []` array form, so register it manually for flat config.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs["recommended-latest"].rules },
  },

  // Must come last: disables ESLint rules that conflict with Prettier.
  prettier,
);
