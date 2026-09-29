import { $ } from "bun";

import { env } from "../src/env";

if (env.VERCEL_ENV === "production") {
  await $`bun run db:migrate`;
  await $`bun run plan:sync`;
}
await $`bun run build`;
