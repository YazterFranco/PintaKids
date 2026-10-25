# Pintakids v2 — Diseño

Fecha: 2026-10-25 · Rama: `feat/v2` · Estado: aprobado en conversación, pendiente revisión escrita.

## 1. Objetivo

Nueva versión moderna y jugable de Pintakids (web PWA + APK Android), tomando Simple Draw como
referencia de usabilidad. **Prioridad nº 1 del dueño: dibujos mejores, modernos y completos, que
además guíen al niño a dibujarlos paso a paso.**

Éxito =
- Los dibujos para colorear se ven como un libro de colorear actual (proporciones reales, contorno
  uniforme, zonas cerradas), no como primitivas sueltas.
- Un niño de 4–8 años puede dibujar un animal completo siguiendo los pasos guiados.
- Los pinceles se sienten reales (crayón con grano, acuarela húmeda, tiza, etc.).
- Navegación simple con pantalla de inicio; lienzo a pantalla completa.
- APK `Pintakids-v2.0.0.apk` firmado y funcionando offline.

## 2. Restricciones (no cambian)

- Contenido 100 % `Pintakids-Original` o CC0. Los dibujos se crean a mano en el proyecto; nada
  descargado de la web, nada de IA de pago. El servidor sigue rechazando otras licencias.
- Sin build, sin dependencias en la web (ES modules puros). Offline (SW + IndexedDB). ES/EN.
- Sin cuentas, sin rastreo, CSP estricta.
- Formato de trazos normalizados compatible: los dibujos/cuentos guardados en v1 siguen abriendo.

## 3. Dibujos (fuente única)

### 3.1 Formato
Cada dibujo es un SVG 400×400 escrito a mano, con:
- Raíz: `fill="#fff" stroke="#2b2d42" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`.
- Pasos: `<g data-step="N" data-name="clave">` en orden de dibujo. Orden de pintado = orden de pasos
  (lo de atrás primero), y las formas con relleno blanco tapan lo que queda detrás.
- Sin `<script>`, sin recursos externos, sin DOCTYPE (regla existente del servidor).
- Detalles de solo-línea usan `fill="none"`; pupilas pueden usar `fill="#2b2d42"`.

Metadatos en el `manifest.json` de cada paquete: `file`, `title` (ES), `title_en`, `level`
(1 Fácil 4–5 pasos · 2 Medio 6–8 · 3 Ingenioso 9–12), `steps` (lista de claves de paso con nombre
ES/EN para la voz), `license`.

### 3.2 Contenido
~60 dibujos nuevos en 8 paquetes: Animales, Granja, Océano, Dinosaurios, Vehículos, Fantasía,
Espacio, Comida. Reemplazan al catálogo v3 (los paquetes viejos se eliminan). Cada uno se revisa
visualmente (render a PNG) antes de aceptarse.

### 3.3 Prueba automática
`catalogo-real.test.ts` se extiende: cada SVG tiene ≥1 `data-step` con `data-name`, pasos
consecutivos desde 1, coincide con `steps` del manifest, y rasterizado (en la prueba web con
canvas/Playwright) produce ≥5 regiones rellenables no-fondo.

## 4. Dibuja conmigo (modo guiado)

1. Se carga el SVG; se separan sus `<g data-step>`.
2. Para el paso actual: lo anterior se muestra tenue (gris 25 %); el paso actual se dibuja con
   línea punteada y una animación de "mano" que lo traza (stroke-dashoffset sobre los paths del paso,
   renderizados a un canvas de guía). Voz: "Ahora dibuja {nombre del paso}".
3. El niño repasa con el crayón en la capa de dibujo.
4. Puntuación por paso: se muestrean puntos de la guía del paso (máscara de línea rasterizada);
   % de puntos con tinta del niño a ≤ r px → 1/2/3 estrellas (≥40/65/85 %). Nunca bloquea.
5. Final: "¡Colorea tu dibujo!" → los trazos del niño (más dilatación para cerrar huecos) pasan a
   Colorear como línea; o "Guardar" a Galería. Opción "ver el dibujo modelo" para colorear el SVG.

Incluye pestaña **Letras y números**: trazos definidos por letra con orden y flechas de dirección,
misma puntuación y voz.

## 5. Motor de pinceles

`core/brushes.js` (nuevo) sustituye la parte de pinceles de `core/paint.js`:
- Estampado procedural a lo largo del trazo con espaciado ∝ tamaño; PRNG con semilla por trazo
  (determinista: deshacer/re-render da el mismo resultado).
- Texturas generadas en código y cacheadas (grano de papel, tiza) — sin imágenes externas.
- Pinceles: crayón, lápiz de color, marcador, acuarela (borde húmedo + mezcla), tiza, neón,
  brillantina, spray, arcoíris, borrador, sellos SVG propios (estrella, corazón, flor, mariposa,
  huella, nube, sol, luna).
- Ancho dinámico por velocidad/presión + suavizado (media móvil) de puntos.
- Formas (rect, elipse, línea, estrella), balde y cuentagotas se conservan.
- Rendimiento: canvas de caché con los trazos confirmados; solo el trazo vivo se repinta por frame.
- Compatibilidad: herramientas v1 (`pencil`, `watercolor`…) se mapean a los pinceles nuevos.

## 6. Pantallas

### 6.1 Inicio
Reemplaza la barra de 7 pestañas. Tarjetas grandes ilustradas: Dibujar, Dibuja conmigo, Colorear,
Foto, Cuentos, Galería. Contador de estrellas. Candado pequeño → Padres (puerta matemática).
Rutas hash existentes se conservan (`#/draw`, `#/color`, …) + `#/home`, `#/learn`.

### 6.2 Dibujar (estilo Simple Draw)
Lienzo a pantalla completa; barra lateral flotante de pinceles (al tocar el activo: ficha de
grosor y opacidad); botón de color grande → paleta (24 colores, rueda HSV, 8 recientes); barra
superior: inicio, deshacer, rehacer, espejo (vertical/horizontal/cuádruple/caleidoscopio), fondo,
guardar, compartir. Zoom/pan con dos dedos + re-encuadrar. Fondos: blanco, papel crema texturizado,
pizarra, cuadriculado, dibujo del catálogo. Autoguardado del dibujo en curso (IndexedDB).

### 6.3 Colorear
Biblioteca con filtros por paquete y dificultad, "Recientes", "Mis dibujos". Rellenos: sólido,
degradado, texturas (puntos, rayas, cuadritos, estrellas), mágico (arcoíris). Pincel recortado a la
región usando los pinceles realistas. Zoom/pan. Borde de relleno sin halo blanco (relleno bajo la
línea dilatada). Deshacer/rehacer. Celebración con confeti al guardar.

### 6.4 Foto → colorear
Recorte/encuadre previo; Sobel + histéresis (Canny simplificado) + cierre morfológico + eliminación
de componentes pequeños; deslizadores "detalle" y "grosor"; vista previa en vivo.

### 6.5 Cuentos
Portada ilustrada, páginas con el lienzo nuevo, plantilla de texto guiado, paso de página animado,
lectura TTS, PDF (se mantiene). Arreglar borrado de cuento (botón no se monta hoy).

### 6.6 Galería y Padres
Galería: tarjetas modernas, abrir para seguir editando dibujos. Padres: añade interruptor de
sonidos de efectos; resto igual.

## 7. Sistema visual
Paleta moderna luminosa (primario violeta-azul, acentos cálidos; menos rosa global), tipografía
Baloo 2 (ya incluida), sombras suaves, radios generosos, tokens en `:root` con modo oscuro real,
transiciones cortas respetando `prefers-reduced-motion`, sonidos cortos generados con WebAudio
(sin archivos) desactivables.

## 8. Pruebas
- Node (`server/test`): brushes deterministas, mapeo v1→v2, parser de pasos SVG, puntuación guiada,
  lineart mejorado, catálogo nuevo (licencias + pasos).
- Playwright: navegación inicio → cada modo, colorear rellena, guiado avanza pasos, offline.
- Verificación visual manual en navegador de cada modo.

## 9. Entrega y APK
Versión 2.0.0 (package.json, Android `versionName`/`versionCode`, SW `pintakids-v9`,
`?v=9`). `./gradlew assembleRelease` con el keystore de `../keystore-pintakids/` →
`../Pintakids-v2.0.0.apk`. Sin push ni despliegue sin confirmación del dueño.

## 10. Fases
1. Sistema visual + inicio + motor de pinceles + Dibujar.
2. Dibujos nuevos (catálogo) + Colorear.
3. Dibuja conmigo + letras, Foto, Cuentos, Galería.
4. Pruebas e2e, versión, APK.

## 11. Fuera de alcance
Capas múltiples editables, cuentas/nube, Play Store, IA generativa.
