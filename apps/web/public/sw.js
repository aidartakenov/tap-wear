// TapWear's service worker. It caches nothing: the catalog must always be fresh.
// Its one job is to show a plain message instead of the browser's error page
// when a page is opened without a connection.
const OFFLINE = `<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TapWear</title>
<body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;color:#111827;text-align:center;padding:24px">
<div><h1 style="font-size:22px;margin:0 0 8px">Нет соединения</h1>
<p style="margin:0 0 20px;color:#4b5563">Проверьте интернет и попробуйте ещё раз.<br>Байланыш жок. Интернетти текшерип, кайра аракет кылыңыз.</p>
<button onclick="location.reload()" style="border:0;border-radius:999px;background:#111827;color:#fff;font-weight:600;padding:12px 24px;font-size:15px">Обновить</button></div>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
