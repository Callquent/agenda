// Service worker de l'agenda : affiche les notifications envoyées par le serveur (aucune mise en cache ici).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Agenda", {
      body: data.body || "",
      tag: data.tag || "agenda",
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(url) && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
