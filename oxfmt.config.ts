import preset from "ultracite/oxfmt";

export default {
  ...preset,
  ignorePatterns: [
    ...(preset.ignorePatterns ?? []),
    "src/components/ui/**",
    "src/app/globals.css",
    "vendor/**",
    ".next/**",
    "next-env.d.ts",
    "drizzle/**",
    "bun.lock",
  ],
};
