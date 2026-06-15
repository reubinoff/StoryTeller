import js from "@eslint/js";
import query from "@tanstack/eslint-plugin-query";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "coverage/**",
      "node_modules/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  ...query.configs["flat/recommended"],
  reactRefresh.configs.vite,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/no-unescaped-entities": "off",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "action",
            "clientAction",
            "clientLoader",
            "headers",
            "links",
            "loader",
            "meta",
            "shouldRevalidate",
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "app/test/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.vitest,
    },
  }
);
