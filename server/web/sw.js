// Service worker: al llegar un "toque" de Web Push, pide los avisos pendientes al servidor,
// los muestra como notificaciones y los confirma (ack) para que no vuelvan a llegar.
importScripts('/creds.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => e.waitUntil(atenderAvisos()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of abiertas) if ('focus' in c) return c.focus();
      return self.clients.openWindow('/');
    })(),
  );
});

async function atenderAvisos() {
  const cred = await kvGet('cred').catch(() => null);
  if (!cred) {
    return mostrar('Sismo registrado', 'Abra la página para ver los detalles.', 'aviso-generico', {});
  }

  let items = [];
  try {
    const r = await fetch(`${cred.base}/v1/devices/${cred.id}/pending`, {
      headers: { authorization: `Bearer ${cred.secret}` },
    });
    if (r.ok) items = (await r.json()).items;
  } catch {
    // Sin red: el siguiente toque volverá a pedir los pendientes.
  }

  // Chrome exige mostrar algo en cada push. Si no hay nada nuevo, un aviso discreto que se reemplaza solo.
  if (items.length === 0) {
    return mostrar('Actualización sísmica', 'Abra la página para ver los sismos recientes.', 'aviso-generico', {});
  }

  for (const it of items) {
    if (it.action !== 'silent') {
      const titulo = it.drill === '1' ? `SIMULACRO: ${it.title}` : it.title;
      await mostrar(titulo, it.body, it.eventId, {
        alarma: it.action === 'alarm',
        reemplazar: it.action === 'update',
        silencioso: it.action === 'info',
      });
    }
    await confirmar(cred, it);
  }
}

function mostrar(titulo, cuerpo, etiqueta, { alarma = false, reemplazar = false, silencioso = false }) {
  return self.registration.showNotification(titulo, {
    body: cuerpo,
    tag: etiqueta,
    renotify: reemplazar,
    requireInteraction: alarma,
    silent: silencioso,
    vibrate: alarma ? [600, 200, 600, 200, 800] : [200, 100, 200],
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: '/' },
  });
}

async function confirmar(cred, it) {
  try {
    await fetch(`${cred.base}/v1/devices/${cred.id}/ack`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cred.secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: it.eventId, action: it.action, receivedAt: Date.now() }),
    });
  } catch {
    // Si falla, el aviso sigue pendiente y se reenviará.
  }
}
