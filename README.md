# Pintakids 🖍️

App infantil de **dibujo, coloreado, aprendizaje y cuentos**. Dibuja como en Simple Draw, pero con
experiencia completa: pinceles, colorear sin salirse de la línea, lecciones paso a paso,
foto→colorear, cuentos con su propia voz, galería y zona de padres.

**Gratis sin condiciones**: todos los dibujos son originales del proyecto (licencia
`Pintakids-Original`) o CC0. Sin anuncios, sin cuentas, sin rastreo: los datos del niño viven solo
en su dispositivo.

Tres entregables, un mismo servidor:

1. **PWA** (`server/web/`): la app completa en JavaScript (ES modules, sin build). Funciona **sin
   internet** (service worker) y todo se guarda en IndexedDB.
2. **App nativa Android** (`android/`): un shell Kotlin que empaqueta la misma PWA en el APK
   (`WebView` + `WebViewAssetLoader`), con puentes nativos (guardar en galería, compartir,
   cámara/micrófono) y autoactualización propia, sin Google ni Firebase.
3. **Servidor** (`server/`): Node.js 22/24, **sin dependencias** (TypeScript nativo). Sirve la PWA,
   el **catálogo de dibujos** (`/v1/catalog`) y el **canal de versiones del APK**.

## Estructura

```
.
├── server/
│   ├── src/         server.ts (HTTP) · catalog.ts (licencias) · static.ts · releases.ts · json.ts
│   ├── catalog/     paquetes de dibujos (manifest.json + SVG gratuitos) — generar: tools/generar-catalogo.mjs
│   ├── web/         LA app: core/ (lógica pura), ui/, modes/ (7 modos), i18n/ (es/en), sw.js
│   └── test/        node:test — 43 pruebas (servidor + core de la app)
├── android/         shell Kotlin (WebView); Gradle copia server/web → assets en cada build
├── tests-e2e/       Playwright: 26 pruebas (Chromium + móvil emulado, incluye offline y axe)
├── tools/           generar-catalogo.mjs · generar-iconos.mjs
└── docs/            API.md (contrato servidor ↔ clientes)
```

## Ejecutar el servidor (local)

Requiere **Node 22.18+**. Sin `npm install`.

```bash
cd server
npm test          # 43 pruebas, sin red
PORT=8080 npm start
```

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `PORT` | no (8080) | Puerto HTTP |
| `RELEASES_DIR` | no (./data/releases) | Dónde se guardan las APK publicadas (volumen `/data` en producción) |
| `ADMIN_TOKEN` | para publicar APKs | Protege `POST /v1/admin/apk` |

El catálogo se sirve desde la imagen (`server/catalog/`), sin base de datos.

## Pruebas

```bash
cd server && npm test                    # unitarias (Node)
cd tests-e2e && npx playwright test      # e2e Chromium + móvil (servidor real en local)
cd android && ./gradlew testDebugUnitTest # reglas de actualización (Kotlin)
```

## Despliegue web en Cloudflare Pages (recomendado, gratis)

La PWA se puede publicar **sin servidor** en Cloudflare Pages (plan Free: assets ilimitados y
100 000 invocaciones/día del Worker). El Worker incluido replica la API del catálogo (`/v1/*`).

```bash
npx wrangler login          # una sola vez (abre el navegador)
npm run cf:preview          # prueba local en http://localhost:8788
npm run cf:deploy           # publica en https://pintakids.pages.dev
```

- Build: `cloudflare/build.mjs` copia `server/web/` a `dist/` y valida el catálogo con las mismas
  reglas de licencia/seguridad que el servidor Node.
- API: `cloudflare/_worker.js` sirve `/v1/health`, `/v1/catalog`, `/v1/catalog/:pack` y los SVG.
- El canal de APK (`/v1/app-version`, `/descargas/app.apk`) responde 404 en Cloudflare: para
  autoactualización Android usa Railway o un bucket R2.
- `dist/` y `.wrangler/` quedan fuera de git.

## Despliegue (Railway)

Igual que el proyecto anterior: Dockerfile de la raíz, volumen en `/data`, health `GET /v1/health`.

1. Servicio desde este repo (builder Docker, `server/Dockerfile`).
2. Volumen montado en `/data` (allí viven las APK publicadas).
3. Variable: `ADMIN_TOKEN`. `PORT` lo inyecta la plataforma.

O desde la terminal con la CLI ya enlazada: `railway up` (o `python3 ../actualizar.py --railway`).

## Publicar una versión del APK (CI)

Secretos en **Settings → Secrets and variables → Actions**: `KEYSTORE_B64`, `KEYSTORE_PASSWORD`,
`ADMIN_TOKEN`; variable `APP_URL`. El keystore vive **fuera del repo** (`../keystore-pintakids/`).

```bash
git tag v1.0.1 && git push origin v1.0.1
```

GitHub Actions compila el APK firmado, la sube al servidor y los teléfonos avisan solos.

## Regla de contenido (no negociable)

El servidor **rechaza** cualquier SVG cuya licencia no esté en `{Pintakids-Original, CC0-1.0}` y
cualquier archivo con `<script>`, recursos externos o `DOCTYPE`. Está probado en `npm test`
(`catalogo-real.test.ts`). Los dibujos nunca tendrán costo de licencia.

## Privacidad

- Sin analítica, sin cookies, sin rastreo. CSP estricta (`default-src 'self'`).
- Dibujos, cuentos y respaldos: solo IndexedDB local; exportación opcional a un archivo JSON.
- Zona de padres protegida con puerta matemática. Sin enlaces externos en la app.
