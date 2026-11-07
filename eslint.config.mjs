import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import stylistic from "@stylistic/eslint-plugin";
import functionSpacing from "./eslint-rules/function-spacing.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    plugins: {
      "@stylistic": stylistic,
      local: { rules: { "function-spacing": functionSpacing } },
    },
    rules: {
      "local/function-spacing": "error",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["return", "throw"] },
        {
          blankLine: "always",
          prev: "*",
          next: ["function", "class", "type", "interface", "enum", "export"],
        },
        {
          blankLine: "always",
          prev: ["function", "class", "type", "interface", "enum", "export"],
          next: "*",
        },
        { blankLine: "always", prev: "*", next: ["const", "let", "var"] },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
