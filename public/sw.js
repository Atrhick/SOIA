// Service worker for the home-screen app and notifications.
// It caches nothing on purpose: every page holds private, changing data, so the
// app always loads fresh from the network exactly as it does in the browser.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'NowTransformed'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/brand/app-icon-192.png',
    badge: '/brand/notification-badge.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (new URL(w.url).origin === target.origin && 'focus' in w) {
        await w.focus()
        if ('navigate' in w) return w.navigate(target.href)
        return
      }
    }
    return self.clients.openWindow(target.href)
  })())
})
