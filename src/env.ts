import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { memberIdSchema } from "./lib/model";

const mcpAccounts = z.record(
  memberIdSchema,
  z.strictObject({
    swiggy: z.strictObject({ token: z.string().min(1) }).optional(),
    blinkit: z
      .strictObject({
        url: z.url().startsWith("https://"),
        token: z.string().min(1),
      })
      .optional(),
  })
);

export const env = createEnv({
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: process.env,
  server: {
    MCP_ACCOUNTS: z
      .string()
      .default("{}")
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "MCP_ACCOUNTS must be valid JSON.",
          });
          return z.NEVER;
        }
      })
      .pipe(mcpAccounts),
    APP_URL: z.url().optional(),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().startsWith("postgresql://"),
  },
});
