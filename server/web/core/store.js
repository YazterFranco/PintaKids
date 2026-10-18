/** IndexedDB: todo del niño vive solo en su dispositivo. Sin cuentas, sin red, costo $0. */

const DB_NAME = 'pintakids';
const DB_VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** kinds: drawing | colored | lineart | story */
export const store = {
  async putItem(item) {
    await tx('items', 'readwrite', (s) => s.put({ ...item, updatedAt: Date.now() }));
    return item;
  },
  async getItems() {
    return (await tx('items', 'readonly', (s) => s.getAll())) ?? [];
  },
  async getItem(id) {
    return (await tx('items', 'readonly', (s) => s.get(id))) ?? null;
  },
  async deleteItem(id) {
    await tx('items', 'readwrite', (s) => s.delete(id));
  },
  async getSettings() {
    const rows = (await tx('settings', 'readonly', (s) => s.getAll())) ?? [];
    return Object.fromEntries(rows.map((r) => [r.k, r.v]));
  },
  async setSetting(k, v) {
    await tx('settings', 'readwrite', (s) => s.put({ k, v }));
  },
  async wipe() {
    await tx('items', 'readwrite', (s) => s.clear());
    await tx('settings', 'readwrite', (s) => s.clear());
  },
  /** Respaldo portable: un solo JSON con todo (el niño puede pasarlo a otro teléfono). */
  async exportBackup() {
    const [items, settings] = await Promise.all([this.getItems(), this.getSettings()]);
    return JSON.stringify({ app: 'pintakids', version: 1, exportedAt: Date.now(), items, settings });
  },
  async importBackup(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return { ok: false, error: 'respaldo-invalido' };
    }
    if (data.app !== 'pintakids' || !Array.isArray(data.items)) return { ok: false, error: 'respaldo-invalido' };
    for (const it of data.items) {
      if (!it || typeof it.id !== 'string' || typeof it.kind !== 'string') return { ok: false, error: 'respaldo-invalido' };
    }
    for (const it of data.items) await this.putItem(it);
    if (data.settings && typeof data.settings === 'object') {
      for (const [k, v] of Object.entries(data.settings)) await this.setSetting(k, v);
    }
    return { ok: true, imported: data.items.length };
  },
};
