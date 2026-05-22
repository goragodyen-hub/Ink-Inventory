// ============================================================
//  Service Worker — Ink Inventory PWA
//  Strategy: Cache-First for assets, Network-First for API
// ============================================================

const CACHE_NAME = 'ink-inventory-v1';

// ไฟล์ที่จะ cache ไว้ใช้ offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.png',
  './manifest.json',
  // External fonts & icons (cache จาก CDN)
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Prompt:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/@phosphor-icons/web'
];

// ============================================================
//  Install — Pre-cache all static assets
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching assets');
      // ใช้ addAll แต่ ignore errors จาก CDN ที่อาจไม่รองรับ CORS
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting(); // activate ทันทีโดยไม่ต้องรอ tab เก่าปิด
    })
  );
});

// ============================================================
//  Activate — ลบ cache เก่าออก
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activate complete');
      return self.clients.claim(); // ควบคุม tab ที่เปิดอยู่ทันที
    })
  );
});

// ============================================================
//  Fetch — จัดการ request
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ---- API calls (Google Apps Script) → Network-First ----
  // ถ้า network ล้มเหลว ให้แสดง offline response
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // ถ้า network ตอบกลับ ให้ส่งต่อปกติ (ไม่ cache API response)
          return response;
        })
        .catch(() => {
          // Network ล้มเหลว → ส่ง offline JSON response
          return new Response(
            JSON.stringify({
              status: 'error',
              message: '📡 ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบเครือข่ายแล้วลองใหม่'
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // ---- Static assets → Cache-First ----
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // ✅ มีใน cache → ส่งกลับทันที (เร็วมาก)
        return cachedResponse;
      }

      // ❌ ไม่มีใน cache → ดึงจาก network แล้ว cache ไว้
      return fetch(event.request)
        .then((networkResponse) => {
          // cache เฉพาะ response ที่สำเร็จ (200 OK)
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // ถ้า network ล้มเหลว และไม่มี cache → แสดงหน้า offline fallback
          // (เกิดขึ้นกับไฟล์ที่ไม่ได้ pre-cache เช่น รูปจาก CDN)
          return new Response(
            '<h1>📵 ออฟไลน์</h1><p>ไม่สามารถโหลดเนื้อหาได้ในขณะนี้</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
    })
  );
});

// ============================================================
//  Background Sync (optional) — ส่ง request ที่ค้างเมื่อ online
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-transactions') {
    console.log('[SW] Background sync triggered');
    // ถ้าต้องการ implement offline queue ในอนาคต ทำที่นี่ได้
  }
});

// ============================================================
//  Push Notifications (optional) — สำหรับอนาคต
// ============================================================
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'Ink Inventory', {
      body: data.body || 'มีการอัปเดตสต๊อก',
      icon: './icon.png',
      badge: './icon.png'
    });
  }
});
