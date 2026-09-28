import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  jsPlugins: ["@shadcn/lint", "eslint-plugin-better-tailwindcss"],
  settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } },
  // Keep declarations and domain ordering readable; formatting belongs to Oxfmt.
  rules: {
    // White is the contrast mask for the travelling weekday indicator.
    "shadcn/no-raw-colors": ["error", { allow: ["text-white"] }],
    "better-tailwindcss/no-concatenated-classes": "error",
    "better-tailwindcss/no-unknown-classes": "error",
    "better-tailwindcss/no-conflicting-classes": "error",
    "better-tailwindcss/no-duplicate-classes": "error",
    "better-tailwindcss/no-deprecated-classes": "error",
    "better-tailwindcss/enforce-canonical-classes": "error",
    "func-style": "off",
    "react/function-component-definition": "off",
    "sort-keys": "off",
    "no-nested-ternary": "off",
    "no-use-before-define": ["error", { functions: false }],
    "unicorn/no-array-reduce": "off",
    complexity: ["error", 90],
    "react/todo": "off",
  },
  ignorePatterns: [
    "src/components/ui/**",
    "src/app/globals.css",
    "vendor/**",
    ".next/**",
    "next-env.d.ts",
    "drizzle/**",
  ],
});
