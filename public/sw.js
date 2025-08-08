/**
 * Service Worker for DCE Platform
 * Optimized for performance with strategic caching
 */

const CACHE_NAME = 'dce-v1'
const STATIC_CACHE = 'dce-static-v1'
const DYNAMIC_CACHE = 'dce-dynamic-v1'
const IMAGE_CACHE = 'dce-images-v1'

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
]

// Assets to cache on first request
const CACHE_STRATEGIES = {
  // Cache first for static assets
  static: [
    /\.(?:js|css|woff2?|eot|ttf|otf)$/,
    /\/assets\//
  ],
  
  // Network first for dynamic content
  dynamic: [
    /\/api\//,
    /\/auth\//
  ],
  
  // Stale while revalidate for images
  images: [
    /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
    /\/images\//,
    /supabase.*storage/
  ]
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event')
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE)
        await staticCache.addAll(STATIC_ASSETS)
        console.log('[SW] Static assets cached')
        
        // Skip waiting to activate immediately
        self.skipWaiting()
      } catch (error) {
        console.error('[SW] Install error:', error)
      }
    })()
  )
})

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event')
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys()
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('dce-') && 
          ![STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE].includes(name)
        )
        
        await Promise.all(
          oldCaches.map(cache => caches.delete(cache))
        )
        
        console.log(`[SW] Cleaned ${oldCaches.length} old caches`)
        
        // Take control of all pages
        self.clients.claim()
      } catch (error) {
        console.error('[SW] Activate error:', error)
      }
    })()
  )
})

// Fetch event - handle all requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }
  
  event.respondWith(handleRequest(request))
})

// Main request handler with different caching strategies
async function handleRequest(request) {
  const url = new URL(request.url)
  
  try {
    // Determine caching strategy
    if (shouldUseStaticCache(request)) {
      return await cacheFirstStrategy(request, STATIC_CACHE)
    }
    
    if (shouldUseImageCache(request)) {
      return await staleWhileRevalidateStrategy(request, IMAGE_CACHE)
    }
    
    if (shouldUseDynamicCache(request)) {
      return await networkFirstStrategy(request, DYNAMIC_CACHE)
    }
    
    // Default: network first with fallback
    return await networkFirstStrategy(request, DYNAMIC_CACHE)
    
  } catch (error) {
    console.error('[SW] Request error:', error)
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE)
      return await cache.match('/offline.html')
    }
    
    // Return a simple error response for other requests
    return new Response('Network error', { status: 503 })
  }
}

// Cache first strategy - for static assets
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  try {
    const response = await fetch(request)
    
    if (response.status === 200) {
      await cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.warn('[SW] Cache first failed:', request.url)
    throw error
  }
}

// Network first strategy - for dynamic content
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  
  try {
    const response = await fetch(request)
    
    if (response.status === 200) {
      await cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', request.url)
    
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    
    throw error
  }
}

// Stale while revalidate strategy - for images
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  
  // Start fetch in background
  const fetchPromise = fetch(request).then(async (response) => {
    if (response.status === 200) {
      await cache.put(request, response.clone())
    }
    return response
  }).catch(() => null)
  
  // Return cached version immediately if available
  if (cached) {
    return cached
  }
  
  // Otherwise wait for network
  const response = await fetchPromise
  if (response) {
    return response
  }
  
  throw new Error('Network and cache failed')
}

// Strategy determination functions
function shouldUseStaticCache(request) {
  return CACHE_STRATEGIES.static.some(pattern => pattern.test(request.url))
}

function shouldUseImageCache(request) {
  return CACHE_STRATEGIES.images.some(pattern => pattern.test(request.url))
}

function shouldUseDynamicCache(request) {
  return CACHE_STRATEGIES.dynamic.some(pattern => pattern.test(request.url))
}

// Message handler for manual updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting phase')
    self.skipWaiting()
  }
})

// Background sync for failed requests (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'retry-failed-requests') {
      event.waitUntil(retryFailedRequests())
    }
  })
}

async function retryFailedRequests() {
  // Implementation would depend on how you want to handle failed requests
  console.log('[SW] Retrying failed requests')
}

// Periodic cache cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupOldCache())
  }
})

async function cleanupOldCache() {
  const cache = await caches.open(IMAGE_CACHE)
  const keys = await cache.keys()
  
  // Remove cached items older than 7 days
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  
  for (const request of keys) {
    const response = await cache.match(request)
    if (response) {
      const cached = new Date(response.headers.get('date')).getTime()
      if (cached < oneWeekAgo) {
        await cache.delete(request)
      }
    }
  }
  
  console.log('[SW] Cache cleanup completed')
}