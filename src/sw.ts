declare const self: ServiceWorkerGlobalScope;

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
      if (client) {
        const navigated = await client.navigate(url).catch(() => null);
        if (navigated) {
          return navigated.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
