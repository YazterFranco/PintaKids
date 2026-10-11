# Sismos en Panamá — Alerta sísmica (SismoPA)

Sistema de monitoreo y **alerta de sismos para Panamá** con datos oficiales en vivo. Combina tres
entregables que comparten un mismo servidor:

1. **Página web** (`server/web/`): mapa en vivo, listado paginado, gráficos, clima, guía de emergencia,
   teléfonos y radios de Panamá, reporte ciudadano "¿Lo sentiste?" y sección educativa. Se instala como
   PWA y envía **notificaciones Web Push**.
2. **App nativa Android** (`android/`): Kotlin + Jetpack Compose. Recibe **alarmas a pantalla completa**
   (aún con el teléfono bloqueado) por un canal propio, sin Google ni Firebase. Incluye la web dentro
   (pestaña "Mapa"), autoactualización y sonido de alarma propio.
3. **Servidor** (`server/`): Node.js 22, **sin dependencias** (usa `node:sqlite` y TypeScript nativo).
   Lee las fuentes, fusiona, decide a quién avisar y entrega.

> **Aviso:** complementa, no reemplaza, a Sinaproc ni al IGC-UP. Los datos son preliminares y pueden cambiar.

## Fuentes de datos

| Fuente | Cómo se lee | Latencia típica |
| --- | --- | --- |
| **IGC-UP** (Instituto de Geociencias, Univ. de Panamá) | Sondeo HTTP cada 20 s (HTML) | 1–3 min tras el sismo |
| **USGS** | Sondeo HTTP cada 60 s (GeoJSON) | 2–8 min |
| **EMSC** | WebSocket en vivo | Segundos |

El servidor **unifica** observaciones del mismo sismo (≤30 s y ≤50 km), **nunca inventa datos** y marca
una fuente en error si cambia de formato. Si ninguna responde en 10 min, avisa "sin datos".

## Cómo decide un aviso

- **Alarma (crítico):** magnitud ≥ umbral regional, o ≥ umbral cercano a ≤ N km del usuario.
- **Notificación (importante):** ≥ magnitud y radio configurables por el usuario.
- **Informativo:** va a un resumen periódico.
- **Réplicas:** un sismo menor que sigue a uno mayor cerca y después se marca como **réplica** de la
  misma secuencia.
- **Correcciones:** si la magnitud cambia ≥ 0.3 o escala de nivel, se reavisa. Cambios de estado llegan
  en silencio. Límite de avisos importantes por hora para no saturar.

## Estructura del repositorio

```
.
├── server/          Servidor Node (TypeScript nativo, node:sqlite) + página web estática
│   ├── src/         Lógica: fuentes, fusión, política, entrega, push, releases
│   ├── web/         Página pública (index.html, app.js, style.css, PWA)
│   ├── data/        guide.json (guía, teléfonos, radios, enlaces)
│   └── Dockerfile   Imagen mínima para Railway / cualquier host con Docker
├── android/         App nativa (Kotlin + Compose). Contrato en docs/API.md
├── docs/API.md      Contrato servidor ↔ clientes (fuentes de verdad)
└── .github/         CI: compila y publica el APK al crear una etiqueta v*
```

## Ejecutar el servidor (local)

Requiere **Node 22.18+**. Sin `npm install`.

```bash
cd server
npm test          # pruebas unitarias e integración (sin red)
npm run probe     # diagnóstico contra las fuentes reales (requiere internet)
PORT=8080 DB_PATH=./data/alertas.sqlite \
  ADMIN_TOKEN="$(openssl rand -hex 32)" \
  VAPID_SUBJECT="mailto:tucorreo@example.com" \
  npm start
```

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `PORT` | no (8080) | Puerto HTTP |
| `DB_PATH` | no | Ruta del SQLite (dispositivos, eventos, entregas, cola) |
| `ADMIN_TOKEN` | para publicar APKs y métricas | Protege `/v1/admin/*` |
| `VAPID_SUBJECT` | no | Contacto para los servicios de push |

Los datos y las llaves VAPID viven junto a la base de datos (volumen `/data` en producción).
**Respalda `alertas.sqlite` y `vapid.json`**: si se pierde `vapid.json`, los navegadores deben re-suscribirse.

## Despliegue (Railway)

El servidor necesita proceso residente (SSE + sondeos + WebSocket), así que va en un PaaS con
contenedores y **volumen persistente**, no en hosting estático ni serverless.

1. Crear el servicio desde este repo con el `Dockerfile` de la raíz.
2. Añadir un **volumen** montado en `/data`.
3. Variables: `VAPID_SUBJECT`, `ADMIN_TOKEN`. El `PORT` lo inyecta la plataforma.
4. Health check: `GET /v1/health`. Generar dominio HTTPS.

Cualquier host con Docker sirve igual (Fly.io, Render, VPS): `docker build -f server/Dockerfile .`.

## Publicar una versión de la app (CI)

El flujo de autoactualización está en `.github/workflows/release.yml`. Requiere en
**Settings → Secrets and variables → Actions**:

- Secrets: `KEYSTORE_B64`, `KEYSTORE_PASSWORD`, `ADMIN_TOKEN`
- Variable: `APP_URL` (URL pública del servidor)

Para lanzar una versión:

```bash
git tag v1.2.3
git push origin v1.2.3
```

GitHub Actions compila el APK firmado, pregunta al servidor el número de versión siguiente, lo sube al
servidor (`POST /v1/admin/apk`) y los teléfonos avisados muestran "Nueva versión disponible → Descargar".

## Página web para familiares

`server/web/` se sirve desde el mismo servidor. Cada teléfono puede activar avisos por Web Push:

- **Android (Chrome):** avisos con el navegador cerrado.
- **iPhone/iPad:** solo agregado a la pantalla de inicio (iOS 16.4+).
- **Firefox Android:** requiere instalar la PWA (menú → "Instalar app").

Las suscripciones van ligadas al dominio: cambiar de URL obliga a re-activar los avisos.

## Notas de seguridad y privacidad

- Canal HTTPS; sin cifrado de extremo a extremo (termina en el proxy).
- La ubicación del usuario se **redondea a ~5 km** antes de guardarse.
- El secreto de cada dispositivo se guarda solo en su teléfono y en el servidor como hash.
- Lista blanca de servicios de push (evita SSRF); lista blanca de archivos estáticos.

## Estado

En producción en Railway con dominio propio. Ver contrato detallado en [`docs/API.md`](docs/API.md).
