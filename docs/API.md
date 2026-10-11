# Contrato servidor ↔ app (v1)

Fuente única de verdad entre `server/` y `android/`. Todo en JSON UTF-8. Las horas viajan en **milisegundos epoch UTC**; la app las muestra en hora de Panamá (UTC-5, sin horario de verano).

Autenticación de dispositivo: `Authorization: Bearer <secret>` (el `secret` lo devuelve el registro, se guarda solo en el teléfono). Los endpoints `GET` públicos no la necesitan.

## Endpoints

| Método y ruta | Auth | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| `POST /v1/devices` | no | `{settings?, location?}` | `201 {deviceId, secret, settings}` |
| `PUT /v1/devices/{id}` | sí | `{settings?, location?}` | `200 {settings}` |
| `GET /v1/devices/{id}/stream` | sí | — | `text/event-stream` (canal en vivo, ver abajo) |
| `DELETE /v1/devices/{id}` | sí | — | `204` |
| `POST /v1/devices/{id}/drill` | sí | — | `202 {sent:true, online:boolean}`; `429` si se pidió hace menos de 60 s. Si la app está desconectada, el simulacro queda en cola |
| `POST /v1/devices/{id}/ack` | sí | `{eventId, receivedAt, action}` | `204` (mide latencia real) |
| `GET /v1/events?limit=50` | no | — | `{events:[Event], generatedAt}` |
| `GET /v1/guide` | no | — | Guía de seguridad (ver `guide.json`) |
| `GET /v1/health` | no | — | `{ok, now, sources:{igc,usgs,emsc}}`; cada fuente: `{ok, lastOkAt, lastError, lastCount}` |
| `GET /v1/admin/latency` | Bearer `ADMIN_TOKEN` (servidor) | — | `{windowHours, count, p50Ms, p95Ms, maxMs}`: recepción − envío de las últimas 24 h |
| `GET /v1/live` | no | — | `text/event-stream` público (eventos `quake` y `health`); página para familiares |
| `GET /v1/web/vapid-key` | no | — | `200 {publicKey}` (llave VAPID pública para suscribir el navegador); `503` si no existe |
| `POST /v1/web/subscriptions` | no | `{endpoint, settings?, location?}` | `201 {deviceId, secret, settings}`; `400` si el endpoint no es HTTPS de un servicio de push conocido. Reemplaza la suscripción anterior del mismo endpoint |
| `GET /v1/devices/{id}/pending` | sí | — | `{items:[PushData]}`: avisos del navegador aún no confirmados |

Errores: `{error:{code, message}}` con HTTP 400 (validación / JSON inválido), 401 (auth), 404, 413 (cuerpo > 16 KB), 429 (simulacro muy pronto), 500 (sin detalles internos).

Notas de implementación del servidor:
- `ack` es idempotente: 204 aunque el aviso ya no exista. La latencia usa la hora del teléfono; si su reloj está desfasado, la métrica se desvía (mostrar `receivedAt` y `sentAt` en el panel de salud).
- Nunca se reenvía el mismo `(dispositivo, eventId, action)`, aunque el servidor reinicie.
- Los avisos que no se confirman con `ack` quedan en cola **30 min**; después caducan (ya no tienen sentido sonando). Al abrir la app, `GET /v1/events` muestra lo ocurrido.

### `location`
`{lat, lon}` en grados decimales. El servidor **redondea a 0.05° (~5 km)** antes de guardarla.

### `settings` (todos opcionales; los que falten toman el valor por defecto)
| Campo | Defecto | Rango válido |
| --- | --- | --- |
| `criticalRegionalMag` | 6.0 | 4.0–9.0 |
| `criticalNearMag` | 5.0 | 3.0–9.0 |
| `criticalNearKm` | 50 | 5–500 |
| `importantMag` | 4.5 | 2.0–9.0 |
| `importantKm` | 150 | 10–1000 |
| `informativeMag` | 4.0 (`null` = apagado) | 2.0–9.0 o `null` |
| `digestMinutes` | 30 | 5–240 |
| `maxImportantPerHour` | 3 | 1–20 |

### `Event` (público)
```json
{"id":"q-1791...","originTime":1791583565000,"lat":7.4616,"lon":-80.27864,"depthKm":18,
 "magnitude":5.4,"magMin":5.4,"magMax":5.4,"status":"revisado","region":"Localizado en Panamá a 18km al este de Tonosí",
 "source":"igc","updatedAt":1791583600000}
```
`status`: `preliminar` | `revisado`. `source`: fuente principal (`igc` | `usgs` | `emsc`).

## Canal en vivo (sin Google ni Firebase)

`GET /v1/devices/{id}/stream` con `Authorization: Bearer <secret>` devuelve un flujo `text/event-stream` que la app mantiene abierto desde un **servicio en primer plano** (con notificación fija "Alerta sísmica activa").

- Cada aviso llega como:
  ```
  id: 42
  event: push
  data: {"type":"quake","action":"alarm", ...}
  ```
  `data` es el mismo objeto JSON que describe la tabla de claves de abajo (todos los valores son strings).
- El servidor envía `: latido` cada 25 s. La app debe reconectar si no recibe nada en 60 s, con espera creciente (5 s, 10 s… máx. 60 s).
- Al reconectar, el servidor reenvía los avisos pendientes; la app los descarta si ya los mostró (por `eventId`+`action`).
- Tras mostrar un aviso, la app envía `POST /v1/devices/{id}/ack` con `{eventId, action, receivedAt}`; eso lo quita de la cola.

## Página web para familiares (navegador)

Una página pública (`/`) muestra el último sismo, la lista reciente y el estado de las fuentes, en vivo, mediante `GET /v1/live` (sin datos personales). Cada familiar puede además activar avisos en su teléfono:

1. La página pide permiso de notificaciones, registra el service worker (`/sw.js`) y obtiene la llave `GET /v1/web/vapid-key`.
2. El navegador crea una suscripción Web Push y la envía a `POST /v1/web/subscriptions`. El servidor devuelve `{deviceId, secret}`; la página los guarda en IndexedDB del navegador.
3. Por cada aviso, el servidor encola el `PushData` y envía a la suscripción un **toque vacío** (sin contenido cifrado; `TTL 600`, `Urgency high`, VAPID ES256).
4. El service worker recibe el toque, llama a `GET /v1/devices/{id}/pending` con el `secret`, muestra la notificación según `action` y confirma con `POST /v1/devices/{id}/ack`.
5. Si el navegador revoca la suscripción (404/410), el dispositivo se elimina y deja de recibir avisos.

Requisitos y límites:
- **HTTPS con dominio público** obligatorio (Web Push no funciona en `http` ni en `localhost` remoto).
- Android con Chrome/Edge/Firefox: funciona con el navegador cerrado, mientras el teléfono tenga conexión.
- iPhone/iPad: solo como **app de pantalla de inicio** (iOS 16.4 o superior), tras "Añadir a pantalla de inicio".
- Las notificaciones se entregan a través del servicio de push del fabricante del navegador (Google, Mozilla o Apple); pueden retrasarse si el teléfono ahorra energía.
- La página no sustituye a la app nativa ni a las alarmas de Sinaproc.

Eventos de `GET /v1/live`:
- `quake`: un `Event` público nuevo o corregido.
- `health`: `{ok, sources}`, cada 60 s y al conectarse. Además, `GET /v1/health` expone `viewers` (clientes de la página) y `devicesOnline`.

## Mensajes push (solo datos; el mismo objeto va por el canal en vivo)

Todos los valores son **strings**. El servidor ya redacta `title` y `body` en español; la app solo los muestra.

| Clave | Ejemplo | Notas |
| --- | --- | --- |
| `type` | `quake` \| `digest` \| `drill` \| `system` | |
| `action` | `alarm` \| `notify` \| `update` \| `info` \| `silent` | ver abajo |
| `level` | `critical` \| `important` \| `informative` | |
| `eventId` | `q-1791...` | id canónico; la app **nunca** muestra dos veces la misma (eventId + action) |
| `title`, `body` | | texto listo para mostrar |
| `mag`, `magMin`, `magMax` | `5.4` | |
| `status` | `preliminar` \| `revisado` | |
| `source` | `igc` | |
| `region` | | texto de la fuente |
| `lat`, `lon`, `depthKm` | | del sismo |
| `originTime` | `1791583565000` | epoch ms UTC |
| `distanceKm`, `bearing` | `142`, `noreste` | solo si el dispositivo tiene ubicación |
| `drill` | `1` | solo en simulacros; la app antepone "SIMULACRO" |
| `sentAt` | epoch ms | para medir latencia |

`action`:
- `alarm`: pantalla completa + sonido de alarma (canal de alarma, uso `USAGE_ALARM`). Solo nivel crítico y simulacros.
- `notify`: notificación de importancia alta con sonido normal.
- `update`: igual que `notify`, pero es una corrección (magnitud o estado) de un aviso previo; reemplaza la notificación anterior del mismo `eventId`.
- `info`: notificación sin sonido (resúmenes de réplicas, eventos tardíos, avisos del sistema).
- `silent`: sin notificación; solo actualizar la lista local.

## Qué debe hacer la app al recibir un push
1. Registrar el `ack` (`POST /v1/devices/{id}/ack`) con la hora de recepción (no bloquea la notificación).
2. Mostrar según `action`.
3. Guardar el evento en la lista local para uso sin conexión.

## Ubicación en segundo plano
La app envía `PUT /v1/devices/{id}` con `location` cuando el dispositivo se mueve más de ~5 km o cada 6 horas como máximo. El servidor la redondea; la app no debe enviar nada más preciso de lo necesario.

## Guía de seguridad (`GET /v1/guide` y `guide.json`)
El mismo JSON se empaqueta en la app (`android/app/src/main/assets/guide.json`) para uso **sin conexión**; la app lo refresca desde el servidor cuando hay red y conserva la copia más reciente.
```json
{
  "version": 1,
  "updatedAt": "2026-10-09",
  "disclaimer": "texto",
  "sources": [{"name": "Sinaproc (vía prensa)", "url": "https://..."}],
  "sections": [
    {"id": "durante", "title": "Durante el sismo", "phase": "before|during|after|tsunami|aftershocks",
     "items": [{"text": "Agáchese, cúbrase y sujétese.", "confirmed": false}]}
  ]
}
```
`confirmed: false` = práctica internacional pendiente de confirmar con Sinaproc; la app lo muestra con la etiqueta "por confirmar".
