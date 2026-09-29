import { eq, sql } from "drizzle-orm";

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
    const saved = await db.transaction(async (tx) => {
      // ponytail: serialize subscription writes; use a quota row if traffic grows.
      await tx.execute(
        sql`lock table ${pushSubscriptions} in share row exclusive mode`
      );
      const [existing] = await tx
        .update(pushSubscriptions)
        .set(keys)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .returning({ endpoint: pushSubscriptions.endpoint });
      if (existing) {
        return true;
      }
      if ((await tx.$count(pushSubscriptions)) >= env.PUSH_SUBSCRIPTION_LIMIT) {
        return false;
      }
      await tx.insert(pushSubscriptions).values({ endpoint, ...keys });
      return true;
    });
    if (!saved) {
      return Response.json(
        { error: "Reminder subscription limit reached." },
        { status: 409 }
      );
    }
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
