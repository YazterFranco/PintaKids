# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

---

## [Sin publicar]

### Añadido
- **Modo oscuro**: soporte completo vía `prefers-color-scheme` en la PWA y variables CSS; preferencia persistida en `localStorage`.
- **CHANGELOG.md**: este archivo, siguiendo el estándar Keep a Changelog.
- **Dependabot**: configuración automática de actualizaciones de Actions y dependencias npm/Gradle en `.github/dependabot.yml`.
- **PWA manifest mejorado**: campo `display_override`, `screenshots`, `share_target` y `handle_links` añadidos a `manifest.json` para mayor compatibilidad con instalación en Android e iOS.

### Modificado
- **README.md**: añadidos badges de CI/release, tabla de contenidos, sección de características destacadas y tagline visual.

---

## [1.0.0] — 2026-01-01

### Añadido
- PWA completa (ES modules, sin build, sin dependencias de terceros) con 7 modos de juego:
  - Dibujo libre con pinceles personalizables.
  - Colorear sin salirse de la línea (canvas + flood-fill).
  - Lecciones paso a paso con guía animada.
  - Foto → colorear (conversión a escala de grises + contorno).
  - Cuentos con voz propia (Web Speech API, sin servidor externo).
  - Galería personal con exportación JSON.
  - Zona de padres protegida con puerta matemática.
- Servidor Node.js 22 sin dependencias (TypeScript nativo): sirve la PWA, el catálogo de dibujos y el canal de autoactualización del APK.
- App nativa Android (Kotlin + WebView) con puentes nativos: guardar en galería, compartir, cámara, micrófono y autoactualización sin Google Play ni Firebase.
- Soporte offline completo via Service Worker e IndexedDB.
- Catálogo de dibujos originales bajo licencia `Pintakids-Original` y CC0; el servidor rechaza cualquier otro tipo de licencia en test.
- Suite de pruebas: 43 unitarias (Node), 26 e2e con Playwright (Chromium + móvil emulado, offline, axe) y pruebas Kotlin en Android.
- CI en GitHub Actions: type-check TypeScript, pruebas unitarias (servidor), pruebas Kotlin y pruebas e2e Playwright.
- Pipeline de release en GitHub Actions: compila el APK firmado al crear un tag `v*` y lo publica en el servidor automáticamente.
- Despliegue en Cloudflare Workers + Static Assets (plan Free) y soporte para Railway con Dockerfile.
- Internacionalización: español e inglés (`server/web/i18n/`).
- Sin analítica, sin cookies, sin rastreo. CSP estricta `default-src 'self'`.

[Sin publicar]: https://github.com/TU_USUARIO/TU_REPO/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/TU_USUARIO/TU_REPO/releases/tag/v1.0.0
