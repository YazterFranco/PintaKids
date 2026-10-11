// Almacén pequeño compartido por la página y el service worker (IndexedDB del mismo origen).
const KV_DB = 'alerta-sismica';
let kvDbPromise = null;

function kvOpen() {
  if (!kvDbPromise) {
    kvDbPromise = new Promise((res, rej) => {
      const r = indexedDB.open(KV_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return kvDbPromise;
}

async function kvGet(key) {
  const db = await kvOpen();
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(key);
    q.onsuccess = () => res(q.result ?? null);
    q.onerror = () => rej(q.error);
  });
}

async function kvSet(key, value) {
  const db = await kvOpen();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(value, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
