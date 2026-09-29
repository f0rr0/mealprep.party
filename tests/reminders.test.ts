import { setSystemTime, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import webpush from "web-push";

import { POST as subscribe } from "@/app/api/reminders/route";
import { GET as send } from "@/app/api/reminders/send/route";
import { env } from "@/env";
import { db } from "@/lib/db";
import { reminderCommand, tomorrowReminder } from "@/lib/reminders";

import { createState } from "./fixtures";

test("service worker displays a fallback and opens the notification's day in an existing or new window", async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const displayed: string[] = [];
  const opened: string[] = [];
  const messages: { type: string; url: string }[] = [];
  let focused = false;
  let focusFails = false;
  let existing = true;
  const client = {
    id: "home-screen",
    url: "https://mealprep.party/",
    focus: () => {
      focused = true;
      return focusFails
        ? Promise.reject(new Error("Cannot focus"))
        : Promise.resolve();
    },
    postMessage: (message: { type: string; url: string }) =>
      messages.push(message),
  };
  let pending: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => {
    pending = promise;
  };
  const worker = await Bun.build({
    entrypoints: [new URL("../src/sw.ts", import.meta.url).pathname],
    target: "browser",
    format: "iife",
  });
  assert.ok(worker.success);
  runInNewContext(await worker.outputs[0].text(), {
    URL,
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      location: { origin: "https://mealprep.party" },
      registration: {
        showNotification: (title: string) => {
          displayed.push(title);
          return Promise.resolve();
        },
      },
      clients: {
        matchAll: () => Promise.resolve(existing ? [client] : []),
        openWindow: (url: string) => {
          opened.push(url);
          return Promise.resolve(client);
        },
      },
    },
  });
  handlers.get("push")?.({
    data: {
      json: () => {
        throw new Error("Invalid JSON");
      },
    },
    waitUntil,
  });
  await pending;
  assert.deepEqual(displayed, ["Tomorrow’s meals"]);
  const click = (url: string) =>
    handlers.get("notificationclick")?.({
      notification: { close: () => {}, data: { url } },
      waitUntil,
    });
  click("/?day=wednesday");
  await pending;
  assert.equal(focused, true);
  assert.equal(opened.length, 0);
  assert.equal(messages.at(-1)?.type, "notification-open");
  assert.equal(messages.pop()?.url, "https://mealprep.party/?day=wednesday");
  focusFails = true;
  click("/?day=wednesday");
  await pending;
  assert.equal(messages.pop()?.url, "https://mealprep.party/?day=wednesday");
  existing = false;
  click("/?day=sunday");
  await pending;
  assert.equal(opened.pop(), "https://mealprep.party/?day=sunday");
  // The first message may arrive before React mounts; ready replays it.
  messages.length = 0;
  const message = (type: string, source = client, url?: string) =>
    handlers.get("message")?.({ source, data: { type, url } });
  message("notification-ready", { ...client, id: "other-window" });
  message("notification-ready", {
    ...client,
    url: "https://elsewhere.example/",
  });
  assert.equal(messages.length, 0);
  message("notification-ready");
  assert.equal(messages.pop()?.url, "https://mealprep.party/?day=sunday");
  message("notification-opened", client, "https://mealprep.party/?day=sunday");
  message("notification-ready");
  assert.equal(messages.length, 0);
  click("https://elsewhere.example/");
  await pending;
  assert.equal(opened.pop(), "https://mealprep.party");
  click("http://[");
  await pending;
  assert.equal(opened.pop(), "https://mealprep.party");
});

test("dispatch retries server errors once, cleans expired subscriptions and caps delivery at midnight", async () => {
  const state = createState();
  const query = spyOn(db.$client, "unsafe");
  const push = spyOn(webpush, "sendNotification");
  const attempts = new Map<string, number>();
  let claimed = false;
  const endpoints = ["ok", "retry", "expired", "failed", "timeout"].map(
    (name) => `https://web.push.apple.com/${name}`
  );
  try {
    setSystemTime(new Date("2026-09-29T18:15:00Z"));
    query.mockImplementation(((sql: string) => ({
      values: () => {
        if (sql.startsWith("select")) {
          return Promise.resolve([
            [
              state.version,
              state.groceries,
              state.pantry,
              state.names,
              state.avatars,
              state.meals,
              state.plan,
            ],
          ]);
        }
        if (sql.includes("returning")) {
          assert.match(sql, /last_sent_day.*is null.*last_sent_day.*</u);
          const rows = claimed
            ? []
            : endpoints.map((endpoint) => [
                endpoint,
                "key",
                "auth",
                "2026-09-30",
              ]);
          claimed = true;
          return Promise.resolve(rows);
        }
        return Promise.resolve([]);
      },
    })) as unknown as typeof db.$client.unsafe);
    push.mockImplementation((subscription, payload, options) => {
      const { endpoint } = subscription;
      const attempt = (attempts.get(endpoint) ?? 0) + 1;
      attempts.set(endpoint, attempt);
      assert.equal(JSON.parse(String(payload)).url, "/?day=wednesday");
      assert.ok(
        options?.TTL !== undefined && options.TTL > 0 && options.TTL <= 900
      );
      assert.equal(options?.topic, "meal-plan-2026-09-30");
      if (endpoint.endsWith("timeout")) {
        return Promise.reject(new Error("socket timeout"));
      }
      const status = endpoint.endsWith("expired")
        ? 410
        : endpoint.endsWith("failed") ||
            (endpoint.endsWith("retry") && attempt === 1)
          ? 503
          : 201;
      if (status !== 201) {
        return Promise.reject(
          new webpush.WebPushError("Push rejected", status, {}, "", endpoint)
        );
      }
      return Promise.resolve({ statusCode: 201, body: "", headers: {} });
    });
    const request = new Request("https://mealprep.party/api/reminders/send", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const results = await Promise.all([send(request), send(request.clone())]);
    assert.equal(results[0].status, 502);
    assert.deepEqual(await results[0].json(), {
      sent: 2,
      expired: 1,
      failed: 2,
    });
    assert.deepEqual(await results[1].json(), {
      sent: 0,
      expired: 0,
      failed: 0,
    });
    assert.deepEqual([...attempts.values()], [1, 2, 1, 2, 1]);
    const writes = query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => !sql.includes("returning"));
    assert.equal(writes.filter((sql) => sql.startsWith("delete")).length, 1);
    assert.equal(writes.filter((sql) => sql.startsWith("update")).length, 2);
  } finally {
    setSystemTime();
    push.mockRestore();
    query.mockRestore();
  }
});

test("reminders use tomorrow in India, including week and year boundaries", () => {
  const plan = createState();
  for (const [now, day, date] of [
    ["2026-09-29T17:00:00Z", "Wednesday", "2026-09-30"],
    ["2026-09-29T17:59:00Z", "Wednesday", "2026-09-30"],
    ["2026-09-27T17:00:00Z", "Monday", "2026-09-28"],
    ["2026-12-31T20:00:00Z", "Saturday", "2027-01-02"],
  ]) {
    const reminder = tomorrowReminder(plan, new Date(now));
    assert.equal(reminder.date, date);
    assert.equal(reminder.url, `/?day=${day.toLowerCase()}`);
    assert.equal(reminder.tag, `meal-plan-${date}`);
  }
});

test("reminder copy uses current meals, resolves names, orders slots and removes repeats", () => {
  const plan = createState();
  plan.names = { member: "Sam" };
  plan.meals = [
    {
      id: "eggs",
      title: "Eggs for {{member}}",
      recipe: "Cook.",
      ingredients: [],
      recipeLink: "",
    },
    {
      id: "dal",
      title: "Dal",
      recipe: "Cook.",
      ingredients: [],
      recipeLink: "",
    },
  ];
  plan.plan = [
    { day: "Wednesday", slot: "Dinner", mealId: "dal", people: ["member"] },
    { day: "Wednesday", slot: "Breakfast", mealId: "eggs", people: ["member"] },
    { day: "Wednesday", slot: "Lunch", mealId: "dal", people: ["member"] },
    { day: "Tuesday", slot: "Lunch", mealId: "eggs", people: ["member"] },
  ];
  const now = new Date("2026-09-29T17:00:00Z");
  assert.equal(tomorrowReminder(plan, now).body, "Eggs for Sam, Dal");
  assert.equal(
    tomorrowReminder(plan, now).title,
    "Tomorrow’s meals · Wednesday"
  );
  plan.meals[0].title = "A".repeat(200);
  assert.equal(tomorrowReminder(plan, now).body, `${"A".repeat(200)}, Dal`);
  plan.meals[0].title = "A".repeat(500);
  assert.equal(tomorrowReminder(plan, now).body, "2 meals planned.");
  plan.meals[0].title = "{{member}}".repeat(50);
  plan.names.member = "S".repeat(40);
  plan.plan = [plan.plan[1]];
  assert.equal(tomorrowReminder(plan, now).body, "1 meal planned.");
  plan.plan = [];
  assert.equal(
    tomorrowReminder(plan, now).body,
    "No meals planned for tomorrow."
  );
});

test("subscription validation rejects arbitrary destinations and malformed keys", () => {
  const command = {
    action: "subscribe",
    subscription: {
      endpoint: "https://web.push.apple.com/device-token",
      keys: { p256dh: `B${"A".repeat(86)}`, auth: "A".repeat(22) },
      expirationTime: null,
    },
  };
  assert.ok(reminderCommand.safeParse(command).success);
  for (const endpoint of [
    "not a URL",
    "http://web.push.apple.com/token",
    "https://127.0.0.1/",
    "https://web.push.apple.com.evil.example/token",
    "https://user:pass@web.push.apple.com/token",
    "https://web.push.apple.com:123/token",
  ]) {
    assert.equal(
      reminderCommand.safeParse({
        ...command,
        subscription: { ...command.subscription, endpoint },
      }).success,
      false
    );
  }
  assert.equal(
    reminderCommand.safeParse({
      ...command,
      subscription: {
        ...command.subscription,
        keys: { p256dh: "bad", auth: "bad" },
      },
    }).success,
    false
  );
});

test("push routes reject unauthenticated sends and cross-origin or invalid subscriptions before DB access", async () => {
  const missing = await send(
    new Request("https://mealprep.party/api/reminders/send")
  );
  assert.equal(missing.status, 401);
  const wrong = await send(
    new Request("https://mealprep.party/api/reminders/send", {
      headers: { authorization: "Bearer wrong" },
    })
  );
  assert.equal(wrong.status, 401);
  const crossOrigin = await subscribe(
    new Request("https://mealprep.party/api/reminders", {
      method: "POST",
      headers: { origin: "https://elsewhere.example" },
      body: "{}",
    })
  );
  assert.equal(crossOrigin.status, 403);
  const invalid = await subscribe(
    new Request("https://mealprep.party/api/reminders", {
      method: "POST",
      headers: { origin: "https://mealprep.party" },
      body: "invalid",
    })
  );
  assert.equal(invalid.status, 400);
});
