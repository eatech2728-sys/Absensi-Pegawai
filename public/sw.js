// Service Worker untuk Presensi Pegawai PWA & Notifikasi Pengingat Shift Lokal
const CACHE_NAME = 'presensi-pegawai-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

let activeReminderTimeout = null;

// 1. Install Event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline application shell...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll warning (some assets may be dynamic):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for dynamic navigation, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore cross-origin API or external calls from strict cache unless images/fonts
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in background (Stale While Revalidate)
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* offline fallback */});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // If offline and request is an HTML navigation, return cached root/index.html
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
    );
  }
});

// 4. Message Event: Communication from client app (Shift reminder scheduling & local notifications)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  console.log('[SW] Received message from client:', data.type, data);

  switch (data.type) {
    case 'SCHEDULE_SHIFT_REMINDER': {
      // Clear previous timer if any
      if (activeReminderTimeout) {
        clearTimeout(activeReminderTimeout);
        activeReminderTimeout = null;
      }

      const { shift, employee, delayMs, reminderTimeStr } = data;
      if (!shift || !employee) return;

      console.log(`[SW] Shift reminder scheduled for ${employee.name} in ${Math.round(delayMs / 1000)}s (${reminderTimeStr})`);

      if (delayMs > 0 && delayMs < 2147483647) { // Max 32-bit setTimeout
        activeReminderTimeout = setTimeout(() => {
          showShiftNotification({
            title: `⏰ Pengingat Presensi Masuk: Shift ${shift.name}`,
            body: `Halo ${employee.name}, waktu masuk kerja pukul ${shift.startTime} WIB segera tiba. Buka aplikasi untuk presensi masuk dengan kamera selfie & GPS!`,
            employeeId: employee.id,
            shiftStartTime: shift.startTime,
            toleranceMinutes: shift.lateToleranceMinutes,
          });
          activeReminderTimeout = null;
        }, delayMs);
      }
      break;
    }

    case 'TRIGGER_SHIFT_NOTIFICATION': {
      // Trigger notification immediately (for testing or manual reminder)
      const { title, body, employeeId, shiftStartTime, toleranceMinutes } = data;
      showShiftNotification({
        title: title || '⏰ Pengingat Presensi Masuk Pagi',
        body: body || 'Waktu shift kerja Anda telah tiba. Segera catat kehadiran masuk!',
        employeeId: employeeId || '',
        shiftStartTime: shiftStartTime || '08:00',
        toleranceMinutes: toleranceMinutes || 15,
      });
      break;
    }

    case 'CANCEL_SHIFT_REMINDER': {
      if (activeReminderTimeout) {
        clearTimeout(activeReminderTimeout);
        activeReminderTimeout = null;
        console.log('[SW] Shift reminder timer cancelled.');
      }
      break;
    }

    case 'SHOW_OUTSIDE_RADIUS_NOTIFICATION': {
      const { title, body, distanceMeters, maxRadiusMeters, officeName, employeeName, attendanceType } = data;
      self.registration.showNotification(title || '⚠️ Peringatan: Anda di Luar Radius Kantor!', {
        body:
          body ||
          `Halo ${employeeName || 'Pegawai'}, posisi Anda berjarak ${distanceMeters}m dari kantor ${officeName || 'Kantor'} (maksimal radius ${maxRadiusMeters}m).`,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'outside-office-radius-alert',
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: {
          url: '/',
          type: 'OUTSIDE_RADIUS_WARNING',
          distanceMeters,
          maxRadiusMeters,
          officeName,
          employeeName,
          attendanceType,
        },
        actions: [
          {
            action: 'action_dinas_luar',
            title: 'Beralih ke Dinas Luar',
          },
          {
            action: 'action_dismiss',
            title: 'Tutup',
          },
        ],
      });
      break;
    }

    default:
      break;
  }
});

// Helper function to show rich notification via ServiceWorkerRegistration
function showShiftNotification({ title, body, employeeId, shiftStartTime, toleranceMinutes }) {
  const options = {
    body: body,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: 'shift-clockin-reminder',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: '/',
      employeeId,
      shiftStartTime,
      toleranceMinutes,
      triggeredAt: new Date().toISOString(),
      action: 'CLOCK_IN_REMINDER',
    },
    actions: [
      {
        action: 'action_clock_in',
        title: 'Presensi Masuk Sekarang',
      },
      {
        action: 'action_dismiss',
        title: 'Tutup',
      },
    ],
  };

  return self.registration.showNotification(title, options);
}

// 5. Notification Click Event: Handle user tapping the notification or notification actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const notifData = event.notification.data || {};

  console.log('[SW] Notification clicked. Action:', action, 'Data:', notifData);

  if (action === 'action_dismiss') {
    return;
  }

  // Open or focus the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const messageType =
        action === 'action_dinas_luar'
          ? 'NOTIFICATION_SWITCH_DINAS_LUAR'
          : notifData.type === 'OUTSIDE_RADIUS_WARNING'
          ? 'NOTIFICATION_OUTSIDE_RADIUS_ALERT'
          : 'NOTIFICATION_OPEN_CLOCK_IN';

      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: messageType,
            payload: notifData,
          });
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(notifData.url || '/');
      }
    })
  );
});

// 6. Notification Close Event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification was dismissed by user.');
});

// 7. Web Push Event (fallback if push message is received from a Web Push server)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || '⏰ Pengingat Presensi Masuk Kerja';
  const body = data.body || 'Waktunya presensi masuk sesuai shift Anda hari ini.';

  event.waitUntil(
    showShiftNotification({
      title,
      body,
      employeeId: data.employeeId,
      shiftStartTime: data.shiftStartTime || '08:00',
      toleranceMinutes: data.toleranceMinutes || 15,
    })
  );
});
