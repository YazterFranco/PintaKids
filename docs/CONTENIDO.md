# Contenido y licencias (regla del dueño)

**Nada de la sección de dibujos puede tener costo.** Aceptado solo:

| Licencia | Qué es | Obligaciones |
| --- | --- | --- |
| `Pintakids-Original` | SVG originales creados por este proyecto (`tools/generar-catalogo.mjs`) | Ninguna |
| `CC0-1.0` | Dominio público | Ninguna |

Prohibido y bloqueado por el servidor + CI: CC-BY, CC-BY-SA, "no comercial", uso personal,
bancos de imágenes, IA de pago, cualquier archivo sin licencia declarada.

## Catálogo actual (incluido en el repo, costo $0)

8 paquetes, 48 dibujos, todos `Pintakids-Original`:

- animales (8), vehiculos (6), naturaleza (6), fantasia (6), espacio (5), comida (5), granja (6), oceano (6).

Generación y revisión: `node tools/generar-catalogo.mjs` y
`server/test/unit/catalogo-real.test.ts` (falla si algún archivo no es gratis sin condiciones).

## Crecimiento sin costo

- **Paquetes nuevos**: carpeta `server/catalog/<pack>` con `manifest.json` (licencia obligatoria) →
  `npm test` y `railway up`. Los teléfonos los reciben vía `/v1/catalog` sin actualizar el APK.
- **Creación del propio niño**: Foto→colorear convierte sus dibujos/fotos en páginas para colorear
  (procesamiento 100 % local). Cada cuento y cada dibujo es contenido nuevo, infinito y gratis.

## Fuentes de texto/voz/sonido

- Tipografía: fonts del sistema (sin costo).
- Voz: Web Speech API del dispositivo (gratis, local).
- Iconos de UI: emojis estándar (sin costo de licencia).
