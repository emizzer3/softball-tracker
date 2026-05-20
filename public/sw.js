const CACHE = 'softball-v1'

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([
        '/softball-tracker/',
        '/softball-tracker/index.html',
      ])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Cache-first for same-origin, network-first for others
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
          return res
        })
        return cached || network
      })
    )
  }
})
