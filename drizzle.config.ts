import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

export default defineConfig({
  dbCredentials: { url: env.DIRECT_URL },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/lib/schema.ts",
  schemaFilter: ["our_kitchen"],
});
