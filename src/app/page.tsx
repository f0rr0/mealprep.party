import { connection } from "next/server";

import Kitchen from "@/components/kitchen";
import { env } from "@/env";
import { readState } from "@/lib/db";

export default async function Page() {
  await connection();
  return (
    <Kitchen
      initialState={readState()}
      deploymentId={env.VERCEL_DEPLOYMENT_ID ?? null}
    />
  );
}
