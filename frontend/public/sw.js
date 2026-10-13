// Service Worker for Faculty File Management System (FFMS)
const CACHE_NAME = 'ffms-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Let network handle all authenticated requests dynamically
  return;
});
