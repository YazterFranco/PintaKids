# Contrato servidor ↔ clientes (v1) — Pintakids

Todo en JSON UTF-8 salvo donde se indique. Horas en milisegundos epoch UTC.

## Endpoints públicos

| Método y ruta | Respuesta |
| --- | --- |
| `GET /v1/health` | `200 {ok:true, app:"pintakids", now, uptimeMs, catalog:<nº dibujos>}` |
| `GET /v1/catalog` | `200 {generatedAt, packs:[{id,name,version,fileCount}], total, licenses:["gratis-sin-condiciones"]}` |
| `GET /v1/catalog/{pack}` | `200 {id,name,version,files:[{file,title,license}]}`; `404` si no existe |
| `GET /v1/catalog/{pack}/files/{archivo.svg}` | `200 image/svg+xml` (`cache-control: immutable`) o `404` |
| `GET /v1/app-version` | `200 {app,versionCode,versionName,notes,mandatory,publishedAt,apkUrl}` o `404` sin versión |
| `GET /descargas/app.apk` | `200 application/vnd.android.package-archive` (adjunto) o `404` |

## Admin (Bearer `ADMIN_TOKEN`)

| `POST /v1/admin/apk` | Sube la APK. Encabezados opcionales: `X-Version-Code` (entero mayor que el actual), `X-Version-Name`, `X-Notes` (URL-encoded), `X-Mandatory: 1`. Errores: `401`, `413` (>40 MB), `400 no-es-apk | version-no-mayor | demasiado-grande`. |

## Reglas del catálogo (licencias gratuitas sin condiciones)

- Licencias aceptadas: **`Pintakids-Original`** (dibujos creados por el proyecto) y **`CC0-1.0`**.
  Cualquier otra (CC-BY, CC-BY-SA, no-comercial, sin licencia) se **rechaza** al cargar.
- Un manifiesto inválido o incompleto se descarta sin tumbar los demás paquetes (`rejected` con motivo).
- SVG inseguro (con `<script>`, `javascript:`, `foreignObject`, recursos externos, `DOCTYPE`/entidades) se rechaza.
- `pack` y `file` validados por expresión regular; el servidor **nunca** lee rutas fuera del catálogo.

## Reglas del canal de versiones

- `version.json` guarda `app:"pintakids"`. Si el volumen conserva metadatos de OTRA app (p. ej. la
  alerta sísmica anterior), se tratan como "sin versión": nunca se sirve una APK de otro canal.
- La escritura es atómica (`.part` + rename): un fallo a mitad no destruye la versión anterior.

## Puente nativo del APK (`window.PintakidsBridge`)

| Método | Efecto |
| --- | --- |
| `saveImage(dataUrl, nombre)` | Guarda el PNG en `Pictures/Pintakids` (MediaStore). |
| `shareImage(dataUrl, nombre)` | Abre el selector de Android (FileProvider, solo lectura). |
| `vibrate(ms)` | Vibración ≤ 80 ms. |
| `appVersion()` | `versionName` del APK instalado. |

## Notas para la app

- La PWA funciona 100 % offline: el service worker precachea la app y guarda catálogo en caché.
- La web detecta `window.PintakidsBridge` y usa el guardado nativo si existe; si no, descarga normal.
