import { z } from "zod";

import { slots, weekdays, withNames } from "./model";
import type { Plan } from "./model";

// Only browser push services are valid destinations, never arbitrary client URLs.
const endpointSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = URL.parse(value);
    if (!url) {
      return false;
    }
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.hostname === "web.push.apple.com" ||
        url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  }, "Unsupported push service.");

export const reminderCommand = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("subscribe"),
    subscription: z.object({
      endpoint: endpointSchema,
      keys: z.strictObject({
        p256dh: z.string().regex(/^B[A-Za-z0-9_-]{86}$/u),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/u),
      }),
    }),
  }),
  z.strictObject({
    action: z.enum(["status", "unsubscribe"]),
    endpoint: endpointSchema,
  }),
]);

export function tomorrowReminder(plan: Plan, now: Date) {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const options = { timeZone: "Asia/Kolkata" };
  const date = new Intl.DateTimeFormat("en-CA", {
    ...options,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
  const day = weekdays.find(
    (value) =>
      value ===
      new Intl.DateTimeFormat("en-US", {
        ...options,
        weekday: "long",
      }).format(tomorrow)
  );
  if (!day) {
    throw new Error("Invalid reminder day.");
  }
  const meals = new Map(plan.meals.map((meal) => [meal.id, meal]));
  const titles = [
    ...new Set(
      plan.plan
        .filter((entry) => entry.day === day)
        .toSorted((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot))
        .flatMap((entry) => {
          const meal = meals.get(entry.mealId);
          return meal ? [withNames(meal.title, plan.names)] : [];
        })
    ),
  ];
  const summary = titles.join(", ");
  // Let the OS truncate the preview; summarize unusually long plans to keep the push payload small.
  return {
    date,
    title: `Tomorrow’s meals · ${day}`,
    body: summary
      ? summary.length > 500
        ? `${titles.length} ${titles.length === 1 ? "meal" : "meals"} planned.`
        : summary
      : "No meals planned for tomorrow.",
    url: `/?day=${day.toLowerCase()}`,
    tag: `meal-plan-${date}`,
    icon: "/app-icon.png",
  };
}
