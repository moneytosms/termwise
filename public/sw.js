// Hand-written so offline routes are explicit. Static assets cache-first; the three offline pages network-first.
const CACHE = "termwise-v1";
const OFFLINE_PAGES = ["/home", "/classes", "/mark"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  if (e.data === "cache-pages") e.waitUntil(cachePages());
  if (e.data === "clear") e.waitUntil(caches.delete(CACHE));
});

async function cachePages() {
  const cache = await caches.open(CACHE);
  await Promise.all(OFFLINE_PAGES.map(async (p) => {
    const res = await fetch(p, { credentials: "include" });
    if (!res.ok || res.redirected) return;
    // The page's own scripts must be here too, or it renders blank offline when first opened.
    const html = await res.clone().text();
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];
    await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
    await cache.put(p, res);
  }));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon") || url.pathname === "/manifest.webmanifest") {
    e.respondWith(caches.match(e.request, { ignoreVary: true }).then((hit) => hit ?? fetch(e.request).then(async (res) => {
      if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    })));
    return;
  }
  if (e.request.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    e.respondWith(fetch(e.request).then(async (res) => {
      if (res.ok && !res.redirected) (await caches.open(CACHE)).put(url.pathname, res.clone());
      return res;
    }).catch(async () => (await caches.match(url.pathname, { ignoreVary: true })) ?? offlineResponse()));
    return;
  }
  if (e.request.mode === "navigate") e.respondWith(fetch(e.request).catch(() => offlineResponse()));
});

function offlineResponse() {
  return new Response('<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><p>Needs a connection</p><p><a href="/home">Back to Home</a></p></div>', { status: 503, headers: { "content-type": "text/html" } });
}

// Background Sync: deliver the outbox with the app closed.
self.addEventListener("sync", (e) => { if (e.tag === "attendance-outbox") e.waitUntil(flushFromWorker()); });

const idb = (req) => new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });

async function flushFromWorker() {
  const db = await idb(indexedDB.open("termwise"));
  try {
    const rows = await idb(db.transaction("outbox").objectStore("outbox").getAll());
    const queued = rows.filter((r) => r.state === "pending" || r.state === "failed");
    if (!queued.length) return;
    const res = await fetch("/api/sync", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientNow: new Date().toISOString(), items: queued.slice(0, 100).map(({ key, state, error, ...item }) => item) }),
    });
    if (res.status === 401) return; // stays queued until sign-in
    if (!res.ok) throw new Error("retry");
    const { results } = await res.json();
    const store = db.transaction("outbox", "readwrite").objectStore("outbox");
    for (const r of results) {
      const row = queued.find((q) => q.sessionId === r.sessionId);
      if (row) store.put({ ...row, state: r.outcome === "conflict" ? "conflict" : r.outcome === "rejected" ? "failed" : "saved", error: r.error });
    }
  } finally { db.close(); }
}
