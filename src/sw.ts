/* oxlint-disable unicorn/require-post-message-target-origin -- Client.postMessage has no targetOrigin; clients are checked against this worker’s origin. */
declare const self: ServiceWorkerGlobalScope;

let notificationTarget: {
  url: string;
  clientId: string | null;
  expires: number;
} | null = null;

self.addEventListener("message", (event) => {
  const client = event.source;
  if (
    !client ||
    !("url" in client) ||
    URL.parse(client.url)?.origin !== self.location.origin ||
    !notificationTarget ||
    notificationTarget.expires < Date.now() ||
    (notificationTarget.clientId && notificationTarget.clientId !== client.id)
  ) {
    return;
  }
  if (event.data?.type === "notification-ready") {
    client.postMessage({
      type: "notification-open",
      url: notificationTarget.url,
    });
  } else if (
    event.data?.type === "notification-opened" &&
    event.data.url === notificationTarget.url
  ) {
    notificationTarget = null;
  }
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
        client.postMessage({ type: "notification-open", url });
        return;
      }
      const opened = await self.clients.openWindow(url);
      if (opened) {
        if (notificationTarget?.url === url) {
          notificationTarget.clientId = opened.id;
        }
        opened.postMessage({ type: "notification-open", url });
      }
    })()
  );
});
