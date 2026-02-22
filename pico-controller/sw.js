// KYRO PICO Controller Service Worker
const CACHE_NAME = 'kyro-pico-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for offline queue
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-commands') {
        event.waitUntil(syncCommands());
    }
});

async function syncCommands() {
    // Sync queued commands when back online
    const db = await openDB();
    const commands = await getQueuedCommands(db);
    
    for (const cmd of commands) {
        try {
            await sendCommand(cmd);
            await removeCommand(db, cmd.id);
        } catch (e) {
            console.error('Failed to sync command:', e);
        }
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('kyro-pico', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('commands', { keyPath: 'id' });
        };
    });
}

function getQueuedCommands(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['commands'], 'readonly');
        const store = transaction.objectStore('commands');
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function removeCommand(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['commands'], 'readwrite');
        const store = transaction.objectStore('commands');
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data.json();
    
    const options = {
        body: data.body || 'New request from KYRO IDE',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: data,
        actions: [
            { action: 'approve', title: 'Approve' },
            { action: 'reject', title: 'Reject' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'KYRO PICO', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'approve') {
        // Send approval to IDE
        sendMessageToIDE({ type: 'approve', id: event.notification.data.id });
    } else if (event.action === 'reject') {
        // Send rejection to IDE
        sendMessageToIDE({ type: 'reject', id: event.notification.data.id });
    } else {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

function sendMessageToIDE(message) {
    // Send message through WebSocket or post to server
    console.log('Sending message to IDE:', message);
}
