// Hey Coach — Service Worker
// Handles background notification checks

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Listen for messages from the main app
self.addEventListener('message', async (event) => {
  if (event.data.type === 'SCHEDULE_CHECK') {
    // Store the items data for notification checks
    await saveToCache('heycoach_items', event.data.items);
  }
  if (event.data.type === 'CHECK_NOW') {
    await checkAndNotify();
  }
});

// Periodic background sync (where supported)
self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'heycoach-daily-check') {
    event.waitUntil(checkAndNotify());
  }
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

async function saveToCache(key, data) {
  const cache = await caches.open('heycoach-data');
  const response = new Response(JSON.stringify(data));
  await cache.put(key, response);
}

async function loadFromCache(key) {
  const cache = await caches.open('heycoach-data');
  const response = await cache.match(key);
  if (!response) return null;
  return JSON.parse(await response.text());
}

async function checkAndNotify() {
  const items = await loadFromCache('heycoach_items');
  if (!items || items.length === 0) return;

  const today = new Date(); today.setHours(0,0,0,0);

  const urgent = [];
  const upcoming = [];

  items.forEach(item => {
    const due = new Date(item.dueDate + 'T00:00:00');
    const days = Math.round((due - today) / 86400000);
    if (days < 0 || days > item.remindDaysBefore) return;
    if (days <= 2) urgent.push({ ...item, days });
    else upcoming.push({ ...item, days });
  });

  if (urgent.length > 0) {
    const names = urgent.map(i => `${i.icon} ${i.title} (${i.days === 0 ? 'TODAY' : i.days === 1 ? 'tomorrow' : `${i.days} days`})`).join('\n');
    self.registration.showNotification('⚠️ Hey Coach — action needed', {
      body: names,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'heycoach-urgent',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      actions: [{ action: 'open', title: 'Open app' }]
    });
  } else if (upcoming.length > 0) {
    const names = upcoming.map(i => `${i.icon} ${i.title} — ${i.days} days`).join('\n');
    self.registration.showNotification('👋 Hey Coach — coming up soon', {
      body: names,
      icon: './icon-192.png',
      tag: 'heycoach-upcoming',
      vibrate: [100]
    });
  }
}
