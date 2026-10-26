# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

---

## [2.0.0] — 2026-10-25

### Añadido
- **Dibuja conmigo**: cada dibujo del catálogo se aprende paso a paso con demostración animada,
  voz, puntuación de 0–3 estrellas por paso (nunca bloquea) y, al final, colorear tu propio dibujo
  o el modelo. Letras A–Z, Ñ y 0–9 con punto de inicio y flecha de sentido.
- **Catálogo v4**: 61 dibujos nuevos hechos a mano en 8 paquetes (animales, granja, océano,
  dinosaurios, vehículos, fantasía, espacio, comida) y 3 niveles. Disponibles sin internet desde la
  primera visita.
- **Pantalla de inicio** con tarjetas ilustradas (sustituye a la barra de 7 pestañas).
- **Motor de pinceles realistas**: crayón, lápiz de color, marcador, acuarela, tiza, neón,
  brillantina, spray, arcoíris y sellos propios; ancho según velocidad; espejos vertical,
  horizontal, cuádruple y caleidoscopio; zoom con dos dedos.
- **Dibujar estilo Simple Draw**: barra lateral de pinceles, selector de color con mezclador y
  recientes, fondos (papel, pizarra, cuadritos, puntitos, dibujo para pintar encima), autoguardado.
- **Colorear v2**: rellenos degradado, puntitos, rayas, cuadritos, brillitos y mágico; pincel que
  no se sale de la zona; rehacer; filtros por nivel; recientes; confeti al guardar.
- **Foto → colorear v2**: bordes limpios (histéresis), recorte cuadrado arrastrable, deslizadores
  de detalle y grosor.
- **Cuentos v2**: portada, modo lectura con paso de página y voz; cada página guarda su imagen.
- Efectos de sonido (desactivables en Padres), modo oscuro real, capturas para la tienda.

### Corregido
- El aviso "sin internet" tapaba el botón Guardar.
- Padres volvía a cargar la app al cambiar el límite de tiempo.
- Borrar un cuento o una página no funcionaba.
- Miniaturas y PDF de cuentos salían con el grosor de línea equivocado.
- Accesos directos del manifiesto apuntaban a rutas inexistentes; se quitó un `share_target` que
  no podía funcionar en un servidor estático.

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
