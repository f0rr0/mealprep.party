import preset from "ultracite/oxfmt";

export default {
  ...preset,
  ignorePatterns: [
    ...(preset.ignorePatterns ?? []),
    "components/ui/**",
    "app/globals.css",
    "vendor/**",
    ".next/**",
    "next-env.d.ts",
    "drizzle/**",
    "bun.lock",
  ],
};
