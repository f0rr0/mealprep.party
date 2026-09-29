/* oxlint-disable unicorn/require-post-message-target-origin -- Client.postMessage has no targetOrigin; clients are checked against this worker’s origin. */
declare const self: ServiceWorkerGlobalScope;

let notificationTarget: {
  url: string;
  clientId: string | null;
  expires: number;
} | null = null;
const targetCache = "mealprep-notification-target";
const targetKey = new URL("/__notification-target", self.location.origin).href;

const saveTarget = async () => {
  try {
    const cache = await caches.open(targetCache);
    /* oxlint-disable unicorn/prefer-response-static-json -- iOS 16.4 supports Web Push but not Response.json. */
    await cache.put(
      targetKey,
      new Response(JSON.stringify(notificationTarget))
    );
    /* oxlint-enable unicorn/prefer-response-static-json */
  } catch {
    // The in-memory target still covers browsers where storage is unavailable.
  }
};

const getTarget = async () => {
  if (notificationTarget) {
    return notificationTarget;
  }
  try {
    const cache = await caches.open(targetCache);
    const saved = await cache.match(targetKey);
    notificationTarget = saved ? await saved.json() : null;
  } catch {
    // Keep navigation available when storage is unavailable.
  }
  return notificationTarget;
};

self.addEventListener("message", (event) => {
  event.waitUntil(
    (async () => {
      const client = event.source;
      const target = await getTarget();
      if (
        !client ||
        !("url" in client) ||
        URL.parse(client.url)?.origin !== self.location.origin ||
        !target ||
        target.expires < Date.now() ||
        (target.clientId && target.clientId !== client.id)
      ) {
        return;
      }
      if (event.data?.type === "notification-ready") {
        client.postMessage({ type: "notification-open", url: target.url });
      } else if (
        event.data?.type === "notification-opened" &&
        event.data.url === target.url
      ) {
        notificationTarget = null;
        try {
          const cache = await caches.open(targetCache);
          await cache.delete(targetKey);
        } catch {
          // The acknowledged in-memory target is already gone.
        }
      }
    })()
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Always display a notification: iOS revokes subscriptions for silent pushes.
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Tomorrow’s meals", {
      body: data.body ?? "Take a look at tomorrow’s meal plan.",
      icon: "/app-icon.png",
      tag: data.tag ?? "meal-plan",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = URL.parse(
    typeof event.notification.data?.url === "string"
      ? event.notification.data.url
      : "/",
    self.location.origin
  );
  const url =
    target?.origin === self.location.origin
      ? target.href
      : self.location.origin;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find(
        (item) => new URL(item.url).origin === self.location.origin
      );
      // iOS can resume the app at its start URL. Keep the destination until React is ready.
      notificationTarget = {
        url,
        clientId: client?.id ?? null,
        expires: Date.now() + 60_000,
      };
      if (client) {
        await client.focus().catch(() => null);
        await saveTarget();
        client.postMessage({ type: "notification-open", url });
        return;
      }
      const opened = await self.clients.openWindow(url);
      if (opened && notificationTarget?.url === url) {
        notificationTarget.clientId = opened.id;
      }
      await saveTarget();
      if (opened) {
        opened.postMessage({ type: "notification-open", url });
      }
    })()
  );
});
