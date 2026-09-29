import { eq } from "drizzle-orm";

import { env } from "@/env";
import { sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { reminderCommand } from "@/lib/reminders";
import { pushSubscriptions } from "@/lib/schema";

export function GET() {
  return Response.json(
    {
      publicKey:
        env.VAPID_PRIVATE_KEY && env.CRON_SECRET
          ? (env.VAPID_PUBLIC_KEY ?? null)
          : null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const input = reminderCommand.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "Invalid subscription." }, { status: 400 });
  }
  const command = input.data;
  if (command.action === "subscribe") {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.CRON_SECRET) {
      return Response.json(
        { error: "Reminders aren’t available yet." },
        { status: 503 }
      );
    }
    const { endpoint, keys } = command.subscription;
    await db
      .insert(pushSubscriptions)
      .values({ endpoint, ...keys })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: keys,
      });
    return Response.json({ enabled: true });
  }
  const where = eq(pushSubscriptions.endpoint, command.endpoint);
  if (command.action === "unsubscribe") {
    await db.delete(pushSubscriptions).where(where);
    return Response.json({ enabled: false });
  }
  const [subscription] = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(where);
  return Response.json({ enabled: !!subscription });
}
