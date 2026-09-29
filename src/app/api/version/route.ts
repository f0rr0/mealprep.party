import { env } from "@/env";

export function GET() {
  return Response.json(
    { deploymentId: env.VERCEL_DEPLOYMENT_ID ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
