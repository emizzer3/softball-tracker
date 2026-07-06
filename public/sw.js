const CACHE = 'softball-v2'

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
  if (!e.request.url.startsWith(self.location.origin)) return

  // The HTML shell references content-hashed asset filenames that change on every
  // deploy, and old hashes are deleted from the server (deploy replaces dist wholesale).
  // A stale cached shell would point at 404s, so navigations must go network-first.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Static assets are content-hashed and immutable once fetched, so cache-first is safe.
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
})
