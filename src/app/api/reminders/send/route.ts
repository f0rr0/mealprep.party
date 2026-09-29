import { timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import webpush from "web-push";

import { env } from "@/env";
import { db, readState } from "@/lib/db";
import { tomorrowReminder } from "@/lib/reminders";
import { pushSubscriptions } from "@/lib/schema";

export const maxDuration = 60;

export async function GET(req: Request) {
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ""}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    !env.CRON_SECRET ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = env;
  if (!publicKey || !privateKey) {
    return new Response("Reminders are not configured", { status: 503 });
  }
  const reminder = tomorrowReminder(await readState(), new Date());
  const expiresAt = Date.parse(`${reminder.date}T00:00:00+05:30`);
  // Claim today's delivery atomically so overlapping cron invocations don't double-send.
  // ponytail: a process crash after claiming can skip one reminder; use a delivery queue if retries become essential.
  const subscriptions = await db
    .update(pushSubscriptions)
    .set({ lastSentDay: reminder.date })
    .where(
      or(
        isNull(pushSubscriptions.lastSentDay),
        lt(pushSubscriptions.lastSentDay, reminder.date)
      )
    )
    .returning();
  const results = await Promise.allSettled(
    subscriptions.map(async ({ endpoint, p256dh, auth }) => {
      const deliver = () =>
        webpush.sendNotification(
          { endpoint, keys: { p256dh, auth } },
          JSON.stringify(reminder),
          {
            vapidDetails: {
              subject: "https://mealprep.party",
              publicKey,
              privateKey,
            },
            TTL: Math.max(
              0,
              Math.min(3600, Math.floor((expiresAt - Date.now()) / 1000))
            ),
            topic: reminder.tag,
            timeout: 10_000,
          }
        );
      try {
        await deliver().catch(async (error: unknown) => {
          // Vercel does not retry failed cron jobs. Retry only explicit server errors;
          // a timeout may already have delivered the notification.
          if (
            error instanceof webpush.WebPushError &&
            error.statusCode >= 500 &&
            error.statusCode < 600
          ) {
            await delay(1000);
            return deliver();
          }
          throw error;
        });
        return "sent";
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          [404, 410].includes(error.statusCode)
        ) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint));
          return "expired";
        }
        await db
          .update(pushSubscriptions)
          .set({ lastSentDay: null })
          .where(
            and(
              eq(pushSubscriptions.endpoint, endpoint),
              eq(pushSubscriptions.lastSentDay, reminder.date)
            )
          );
        return "failed";
      }
    })
  );
  const sent = results.filter(
    (result) => result.status === "fulfilled" && result.value === "sent"
  ).length;
  const expired = results.filter(
    (result) => result.status === "fulfilled" && result.value === "expired"
  ).length;
  const failed = results.length - sent - expired;
  return Response.json(
    { sent, expired, failed },
    { status: failed ? 502 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
