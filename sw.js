// Service worker بسيط، غرضه الوحيد تمكين خاصية "التثبيت بضغطة واحدة" على أندرويد.
// لا يقوم بأي تخزين مؤقت أو اعتراض فعلي للشبكة.
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  // تمرير الطلبات كما هي دون أي تعديل
});
