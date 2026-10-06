// Firebase Cloud Messaging Service Worker for FoodLink
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA5cD860h2LAHosJgd-y5t2DixdhcRt69U",
  authDomain: "atomic-subject-c3skh.firebaseapp.com",
  projectId: "atomic-subject-c3skh",
  storageBucket: "atomic-subject-c3skh.firebasestorage.app",
  messagingSenderId: "799494278662",
  appId: "1:799494278662:web:524831ae9a1baadd663d87"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'FoodLink Surplus Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New surplus food activity in your area.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    data: payload.data || {},
    actions: [
      { action: 'open_app', title: 'Open FoodLink' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
