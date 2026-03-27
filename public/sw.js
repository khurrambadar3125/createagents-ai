/**
 * CreateAgent.ai Service Worker
 * Enables PWA install prompt + offline caching
 */

const CACHE_NAME = 'createagent-v1'
const PRECACHE = [
  '/dashboard',
  '/templates',
  '/build',
  '/auth',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install — precache key pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  )
  self.clients.claim()
})

// Fetch — network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET, API calls, and streaming
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  if (request.url.includes('supabase')) return
  if (request.headers.get('accept')?.includes('text/event-stream')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Serve from cache when offline
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Fallback to dashboard for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/dashboard')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
