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
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(32).optional(),
    PUSH_SUBSCRIPTION_LIMIT: z.coerce.number().int().positive().default(50),
  },
});
