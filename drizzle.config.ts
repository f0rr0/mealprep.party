import { defineConfig } from "drizzle-kit";

import { env } from "./env";

export default defineConfig({
  dbCredentials: { url: env.DIRECT_URL },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./lib/schema.ts",
  schemaFilter: ["our_kitchen"],
});
