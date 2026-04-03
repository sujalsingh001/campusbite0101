// CampusBite Push Notification Service Worker

self.addEventListener('push', function(event) {
  let data = { title: 'CampusBite', body: 'You have a new update' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'campusbite-notification',
    renotify: true,
    requireInteraction: data.status === 'ready',
    data: {
      url: data.url || '/',
      order_id: data.order_id || '',
      status: data.status || ''
    },
    vibrate: data.status === 'ready' ? [200, 100, 200, 100, 200] : [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'CampusBite', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
