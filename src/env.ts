import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: process.env,
  server: {
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    APP_URL: z.url().optional(),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().startsWith("postgresql://"),
  },
});
