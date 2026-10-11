# Servidor de alertas sísmicas (Panamá)

Lee **IGC-UP**, **USGS** y **EMSC**, fusiona las observaciones del mismo sismo, decide a
qué teléfono avisar según sus ajustes y su ubicación, y entrega el aviso por un **canal
propio** (conexiones SSE que la app mantiene abiertas). No usa Firebase ni cuentas de
Google. El contrato con la app está en `../docs/API.md`.

> Complementa, no reemplaza, a Sinaproc y al IGC-UP. Los datos pueden ser preliminares y cambiar.

## Requisitos

- Node.js **22.18 o superior** (TypeScript nativo y `node:sqlite`, sin banderas).
- Sin dependencias npm. No hay `npm install`.

## Probar

```bash
cd server
npm test            # 82 pruebas unitarias e integración, sin red
npm run probe       # diagnóstico contra las fuentes reales (requiere internet)
```

`npm test` cubre: parsers de las tres fuentes, fusión, política de notificación
(alarma, importante, resumen, correcciones, límite por hora, eventos viejos), API (auth,
validación, simulacro con enfriamiento, acuse, privacidad de ubicación), supervisor (no
repetir tras reiniciar, watchdog "sin datos"), cola y entrega (reconexión, caducidad,
acuse) y sondeo de fuentes.

Prueba de extremo a extremo (ya verificada): registro → conexión SSE → simulacro llega
por el canal → acuse → segundo simulacro responde 429.

## Ejecutar

```bash
PORT=8080 DB_PATH=./data/alertas.sqlite \
ADMIN_TOKEN="$(openssl rand -hex 32)" \
npm start
```

| Variable | Obligatoria | Por defecto | Uso |
| --- | --- | --- | --- |
| `PORT` | no | `8080` | Puerto HTTP |
| `DB_PATH` | no | `./data/alertas.sqlite` | Base SQLite (dispositivos, eventos, entregas, cola) |
| `ADMIN_TOKEN` | para métricas | — | Protege `GET /v1/admin/latency` |
| `VAPID_SUBJECT` | no | `mailto:alertas@example.com` | Contacto que los servicios de push pueden usar (poner un correo real) |
| `IGC_URL` / `USGS_URL` / `EMSC_WS_URL` | no | URLs oficiales | Sustituir solo para pruebas |

El servidor debe ir detrás de HTTPS (proxy inverso con certificado válido): la app solo
acepta conexiones HTTPS.

## Despliegue

Imagen Docker (desde la raíz del repositorio):

```bash
docker build -f server/Dockerfile -t alerta-sismica-pa .
docker run -d --name alerta -p 8080:8080 \
  -v alerta-data:/data \
  -e ADMIN_TOKEN="..." \
  --restart unless-stopped \
  alerta-sismica-pa
```

Producción: respaldo diario de `alertas.sqlite` y monitor externo sobre `GET /v1/health`.

## Cómo decide el servidor

- **Fusión:** dos observaciones son el mismo sismo si ocurren con ≤30 s y ≤50 km. La
  fuente principal es IGC-UP; la magnitud y el estado final salen de las fuentes disponibles.
- **Niveles:** `critical` (alarma) si la magnitud ≥ `criticalRegionalMag` en la zona, o ≥
  `criticalNearMag` a ≤ `criticalNearKm`. `important` (notificación) si ≥ `importantMag` a
  ≤ `importantKm`. `informative` va al resumen cada `digestMinutes`.
- **Entrega:** cada aviso se guarda en una cola por teléfono. Sale al instante si el
  teléfono está conectado, o al reconectarse. Caduca a los 30 min.
- **Sin repetidos:** cada `(dispositivo, evento, acción)` se encola una sola vez, aunque el
  servidor reinicie.
- **Correcciones:** solo si la magnitud cambia ≥0.3; cambios de estado llegan en silencio.
- **Eventos viejos:** si un evento tiene más de 30 min al verlo por primera vez, solo informa.
- **Límite:** máximo `maxImportantPerHour` avisos importantes por hora por dispositivo; los
  que sobran llegan sin sonido.
- **Watchdog:** si ninguna fuente responde en 10 min, avisa a todos una vez y otra al recuperarse.
- **Privacidad:** la ubicación se redondea a 0.05° (~5 km) antes de guardarse.

## Operación

- `GET /v1/health`: `devicesOnline`, y estado de cada fuente (`lastOkAt`, `lastError`).
- `GET /v1/admin/latency` (con `ADMIN_TOKEN`): latencia de entrega de las últimas 24 h.
- Si una fuente cambia de formato, queda marcada en error; el servidor **no inventa datos**.

## Validación obligatoria antes de usarlo en la vida real

Estas pruebas no pudieron hacerse desde el entorno donde se escribió el código:

1. **Parser de IGC-UP contra la página real.** Ejecutar `npm run probe` varios días. Si
   reporta "no se encontró la tabla", ajustar `src/sources/igc.ts` con una captura real
   (guardar el HTML en `test/fixtures/` y añadir la prueba).
2. **Latencia real.** Medir `GET /v1/admin/latency` durante 7 días en modo sombra.
3. **Alarma en teléfono real** desde la app, con pantalla bloqueada, en al menos dos
   fabricantes distintos (Android 13 y 14), y con la app cerrada por el sistema.
4. **Revisión de la guía** (`data/guide.json`) con Sinaproc: los ítems con `"confirmed": false`
   están pendientes.

## Limitaciones conocidas

- Un solo proceso: la cola y las conexiones viven en esta instancia. Para varias réplicas
  haría falta un broker.
- Sin cifrado extremo a extremo: el canal es HTTPS, terminado en el proxy inverso.
- Si el teléfono está apagado o sin conexión más de 30 min, pierde la alarma en directo; al
  abrir la app verá los sismos en la lista.
- Las fuentes globales (USGS/EMSC) solo se usan dentro de la zona de interés (`src/config.ts`).
- La latencia depende del reloj del teléfono (ver `docs/API.md`).

## Página web para familiares

El mismo servidor sirve la página (`web/`): último sismo, lista reciente y estado de las fuentes en vivo (`GET /v1/live`), y permite que cada teléfono reciba avisos por Web Push.

- Las llaves VAPID se crean solas la primera vez en `vapid.json`, junto a la base de datos (permisos 600). **Guárdelo con la base de datos**: si se pierde, los navegadores deben volver a suscribirse.
- Requiere **HTTPS con dominio público** (por ejemplo un VPS con Caddy o un túnel HTTPS). Sin HTTPS, la página se ve pero no hay avisos.
- Android (Chrome, Edge, Firefox): avisos aunque el navegador esté cerrado.
- iPhone/iPad: solo desde la pantalla de inicio (iOS 16.4 o superior).
- Pruebas hechas aquí: pruebas unitarias del envío VAPID, lista blanca de endpoints, archivos estáticos, API de suscripción y entrega. **No probado** con un navegador real contra un servicio de push: eso exige el dominio público y un teléfono.
- Detalles del contrato en `docs/API.md`, sección "Página web para familiares".
