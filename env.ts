import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: process.env,
  server: {
    APP_URL: z.url().optional(),
    BLINKIT_PARTNER_MCP_TOKEN: z.string().min(1).optional(),
    BLINKIT_PARTNER_MCP_URL: z.url().startsWith("https://").optional(),
    BLINKIT_SID_MCP_TOKEN: z.string().min(1).optional(),
    BLINKIT_SID_MCP_URL: z.url().startsWith("https://").optional(),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().startsWith("postgresql://"),
    SWIGGY_PARTNER_ACCESS_TOKEN: z.string().min(1).optional(),
    SWIGGY_SID_ACCESS_TOKEN: z.string().min(1).optional(),
  },
});
