# Pintakids v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modern, playable Pintakids v2: hand-made step-structured drawings, guided "Dibuja conmigo", realistic brush engine, Simple-Draw-style canvas, home screen, improved Colorear/Foto/Cuentos, signed APK 2.0.0.

**Architecture:** Same no-build PWA in `server/web/` (ES modules) + Kotlin WebView shell. Pure logic in `core/` (Node-testable), DOM in `ui/` and `modes/`. Drawings are SVGs with `<g data-step>` groups shared by Colorear and the guided mode.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D, IndexedDB, Web Speech, WebAudio; Node 24 `node:test` with native TS; Playwright; Gradle/Kotlin.

**Spec:** `docs/superpowers/specs/2026-10-25-pintakids-v2-design.md`

## Global Constraints

- Licenses only `Pintakids-Original` or `CC0-1.0`; SVGs hand-authored in repo; no `<script>`, external refs, DOCTYPE.
- No web dependencies, no build step; works offline; ES + EN keys symmetric (`web-i18n.test.ts`).
- SVG drawings: viewBox `0 0 400 400`, root `fill="#fff" stroke="#2b2d42" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`, steps `<g data-step="N" data-name="key">` N=1..k consecutive.
- Levels: 1 = 4–5 steps, 2 = 6–8, 3 = 9–12.
- Guided score thresholds: ≥40 % → 1★, ≥65 % → 2★, ≥85 % → 3★; never blocks.
- v1 saved strokes must still deserialize and render.
- Cache-busting `?v=9`, SW `pintakids-v9`, bootcheck `BUILD='v9'`; app version 2.0.0, Android versionCode 4.
- No git push / deploy without owner confirmation.

## Review Focus

- v1 drawings in IndexedDB using tool `pencil`/`watercolor` etc. must open in Gallery and Draw → test in Task 2.
- Child taps "next" without drawing anything in guided mode → 0 ★, advances, no crash → test in Task 7.
- Fill tap on a line pixel or on background region does nothing → existing behavior kept, test in Task 6.
- Very large / portrait photo in Foto → downscaled, square-padded, no crash → test in Task 8.
- App killed mid-drawing → autosave restores on next open → e2e in Task 4.

---

### Task 1: Visual system + home screen + router

**Files:**
- Modify: `server/web/style.css` (rewrite tokens + components), `server/web/index.html`, `server/web/app.js`, `server/web/ui/icons.js`, `server/web/i18n/{es,en}.json`
- Create: `server/web/modes/home.js`, `server/web/core/sfx.js`
- Test: `tests-e2e/specs/app.spec.ts`

**Interfaces:**
- Produces: `VIEWS = ['home','draw','learn','color','photo','story','gallery','parents']`; default route `home`; `ctx.app.go(view)`; body class `in-mode` hides header when a full-screen mode is active; `sfx.play(name: 'tap'|'fill'|'star'|'pop')` (WebAudio, respects `app.settings.sfx !== false`).
- Each mode view gets a shared top bar created by `ui/parts.js: modeBar(title: string, onHome: () => void, ...actions: HTMLElement[]) → HTMLElement`.

- [ ] Step 1: Update e2e `cambiar de pestaña monta cada modo` → navigates from `#/home` cards (`[data-testid="home-card-<view>"]`) to each mode and back via `[data-testid="home"]`; expect no console errors. Run `cd tests-e2e && npx playwright test app.spec.ts -g "monta cada modo"` → FAIL.
- [ ] Step 2: Remove tabbar/washi from `index.html`; add `#view-home`, `#view-learn`; header becomes compact (logo, stars, lock button → parents).
- [ ] Step 3: Rewrite `style.css` tokens: primary `#6c5ce7`, accents `#ff7675` `#fdcb6e` `#00b894` `#0984e3`, bg `#f7f5ff`, ink `#2d3436`; dark theme under `[data-theme=dark]` and `prefers-color-scheme` guard; soft shadows `0 8px 24px rgba(45,52,54,.12)`; radii 16/24/32; keep Baloo 2.
- [ ] Step 4: `home.js`: grid of 6 large illustrated cards (inline SVG art per card, label, color), stars counter.
- [ ] Step 5: `sfx.js` with short oscillator envelopes; parents panel toggle `sfx`.
- [ ] Step 6: Run e2e + `cd server && npm test` → PASS. Verify visually in browser (light + dark, 390px and 1024px widths).
- [ ] Step 7: Commit `feat(web): sistema visual v2 y pantalla de inicio`.

### Task 2: Brush engine

**Files:**
- Create: `server/web/core/brushes.js`
- Modify: `server/web/core/paint.js` (delegate stroke painting), `server/web/core/strokes.js` (tool list + v1 alias map)
- Test: `server/test/unit/web-brushes.test.ts` (uses a minimal fake 2D context recording calls)

**Interfaces:**
- Produces: `BRUSHES = ['crayon','colorpencil','marker','watercolor','chalk','neon','glitter','spray','rainbow','eraser','stamp']`; `TOOL_ALIASES = { pencil: 'colorpencil' }`; `smoothPoints(pts: number[], k = 3) → number[]`; `strokeWidthAt(i, pts, base, w, h) → number` (speed-based, clamp 0.55–1.25 × base); `paintBrush(ctx, stroke, w, h)`; `STAMP_SHAPES` (keys: star, heart, flower, butterfly, paw, cloud, sun, moon) each `(ctx, size) => void`.
- Stroke object unchanged `{t,c,s,p,m,ch,o?}`; new optional `o` opacity 0.1–1 and `m` may be `'v'|'h'|'quad'|'kaleido'|true|false` (true ≡ `'v'`).

- [ ] Step 1: Tests: `deserializeStrokes` accepts v1 `pencil` and maps it; `smoothPoints` keeps endpoints and length; `paintBrush` deterministic (two runs over fake ctx produce identical call logs); each brush in `BRUSHES` paints ≥1 op for a 3-point stroke; mirror `'quad'` paints 4 copies via `paintAll`. Run `cd server && npm test` → FAIL.
- [ ] Step 2: Implement stamping along path: spacing = max(1, size·0.15) px; per-brush stamp: crayon = paper-grain mask (cached 128px noise pattern) with `destination-in`; colorpencil = thin, alpha 0.6, grain; marker = round stamps alpha 0.85 on a temp layer then composited (no self-overlap darkening within a stroke); watercolor = soft radial stamps alpha 0.08 + darker edge pass (`multiply`); chalk = sparse grain dots; neon = `shadowBlur` glow + white core.
- [ ] Step 3: Tests pass; commit `feat(web): motor de pinceles realistas`.

### Task 3: Drawing surface v2 (performance, zoom/pan, autosave)

**Files:**
- Modify: `server/web/ui/surface.js`
- Create: `server/web/core/viewport.js`
- Test: `server/test/unit/web-viewport.test.ts`

**Interfaces:**
- Produces: `createViewport() → { scale, tx, ty, toCanvas(x,y) → [x,y], pinch(p1a,p2a,p1b,p2b), reset() }` (scale clamp 1–5); surface gains `opts.background`, `opts.underlay(ctx,w,h)` (for catalog drawing backgrounds), `surface.setMirror(mode)`, `surface.onChange(cb)`; committed strokes cached in an offscreen canvas, only live stroke redrawn per rAF.

- [ ] Step 1: Tests for viewport math (identity mapping, pinch zoom keeps midpoint fixed, clamp). FAIL.
- [ ] Step 2: Implement; two-pointer gesture = pinch/pan and cancels live stroke; one pointer = draw.
- [ ] Step 3: Tests pass; commit `feat(web): lienzo con caché, zoom y espejos`.

### Task 4: Draw mode (Simple Draw style)

**Files:**
- Modify: `server/web/modes/draw.js`, `server/web/ui/parts.js`
- Create: `server/web/ui/colorpicker.js`
- Test: `tests-e2e/specs/app.spec.ts` (draw tests)

**Interfaces:**
- Consumes: Task 2 `BRUSHES`, Task 3 surface API, Task 1 `modeBar`.
- Produces: `openColorPicker(anchor, current, onPick)` (24-colour grid, HSV wheel canvas, 8 recents persisted in setting `recentColors`); autosave key setting `drawDraft` (serialized strokes + bg) written debounced 800 ms, restored on mount.

- [ ] Step 1: e2e: draw stroke → undo enabled; select `chalk` from side rail; open colour picker, pick; reload page → strokes restored (autosave); save → star +1. FAIL.
- [ ] Step 2: Implement full-screen layout: side rail (brushes + shapes + fill + picker + eraser + stamp), tool sheet (size, opacity, stamp shape), top bar actions (undo, redo, mirror menu, background menu incl. catalog drawing as underlay, save, share/export).
- [ ] Step 3: e2e pass + visual check; commit `feat(web): modo Dibujar estilo Simple Draw`.

### Task 5: New drawing catalog (~60 hand-made SVGs)

**Files:**
- Delete: `tools/catalog-*.mjs`, all of `server/catalog/*`
- Create: `tools/drawings/<pack>/<id>.svg` (sources), `tools/drawings/<pack>/pack.json` (`{name, name_en, items:[{id,title,title_en,level,steps:[{key,es,en}]}]}`), rewrite `tools/generar-catalogo.mjs` (copies + validates + writes `server/catalog/<pack>/manifest.json`), `tools/render-preview.mjs` (writes PNG previews via `qlmanage` on macOS into scratch dir)
- Modify: `server/src/catalog.ts` (`CatalogFile` gains `title_en?: string; level?: 1|2|3; steps?: {key,es,en}[]`), `cloudflare/_worker.js`/`build.mjs` if they whitelist fields
- Test: `server/test/unit/catalogo-real.test.ts`, `server/test/unit/web-svgsteps.test.ts`

**Interfaces:**
- Produces: `server/web/core/svgsteps.js`: `parseSteps(svgText) → { viewBox, steps: [{ n, key, markup }] }`, `svgUpTo(parsed, n, { dimBefore?: boolean }) → string` (SVG text with steps ≤ n; earlier ones wrapped in `opacity=".25"` when dimBefore), `stepOnly(parsed, n) → string`.
- Packs: `animales`, `granja`, `oceano`, `dinosaurios`, `vehiculos`, `fantasia`, `espacio`, `comida` — 7–8 drawings each, each pack mixing levels 1–3.

- [ ] Step 1: Tests: real catalog has 8 packs, ≥56 drawings, each SVG passes `svgIsSafe`, `parseSteps` yields consecutive steps 1..k matching manifest `steps.length`, level matches step-count ranges; `parseSteps` unit cases (missing data-name rejected, order sorted). FAIL.
- [ ] Step 2: Author drawings pack by pack using the style of the approved sample cat; after each pack run `node tools/render-preview.mjs <pack>` and inspect every PNG; fix anything asymmetric, open, or cluttered before moving on.
- [ ] Step 3: Generate catalog; tests pass; commit per pack `feat(catalogo): paquete <pack> v4`.

### Task 6: Colorear v2

**Files:**
- Modify: `server/web/modes/color.js`, `server/web/core/colorfill.js`
- Create: `server/web/core/fills.js`, `server/web/ui/celebrate.js`
- Test: `server/test/unit/web-colorfill.test.ts`, `server/test/unit/web-fills.test.ts`, e2e coloring tests

**Interfaces:**
- Consumes: Task 5 manifest fields (`level`, `title_en`), Task 2 `paintBrush` (brush mode clipped to region mask), Task 3 viewport.
- Produces: `fills.js`: `FILL_KINDS = ['solid','gradient','dots','stripes','checks','stars','magic']`; `fillRegionStyled(out, labels, region, kind, rgba, bbox) → count`; `regionBBox(labels, region, w) → {x0,y0,x1,y1}`. `celebrate(root)` confetti (reduced-motion → static stars). Fill painted under a 1px-dilated line mask so no white halo.

- [ ] Step 1: Tests: each fill kind paints exactly the region's pixel count and nothing outside; gradient endpoints differ; tapping line (-1) or background region is a no-op; redo after undo restores. FAIL.
- [ ] Step 2: Implement library UI (pack chips, level filter, recents from setting `recentColoring`, "Mis dibujos" = gallery items kind `lineart`), fill-kind selector, brush clipped to region, zoom, undo/redo, celebration on save.
- [ ] Step 3: Tests + e2e pass; visual check; commit `feat(web): Colorear v2`.

### Task 7: Dibuja conmigo (guided) + letters

**Files:**
- Rewrite: `server/web/modes/learn.js`
- Create: `server/web/core/guide.js`, `server/web/core/letters.js`
- Test: `server/test/unit/web-guide.test.ts`, `tests-e2e/specs/flows.spec.ts`

**Interfaces:**
- Consumes: `parseSteps/svgUpTo/stepOnly` (Task 5), surface (Task 3), `sfx`, `speak`.
- Produces: `guide.js`: `samplePoints(mask: Uint8Array, w, h, max = 400) → Int32Array` (indices of line pixels, evenly subsampled), `coverage(samples, inkAlpha: Uint8ClampedArray, w, radius) → 0..1`, `starsFor(cov) → 0|1|2|3` (thresholds from Global Constraints). `letters.js`: `LETTERS: Record<string, {strokes: number[][]}>` for A–Z, Ñ, 0–9 in 0..1 coords, each stroke ordered with direction.
- Flow: pick drawing (cards from catalog filtered by level) → per step: animated dashed demo (dashoffset over path rendered from `stepOnly`), voice "Ahora dibuja {es}" / "Now draw {en}", child traces, "¡Listo!" scores and shows stars → next. End screen: total stars, "¡Colorea tu dibujo!" (child strokes rendered black, dilated, passed as `ctx.pendingLineart` to Colorear), "Colorear el modelo", "Guardar".

- [ ] Step 1: Tests: `coverage` = 1 when ink covers all samples, 0 with empty ink, partial ~0.5 for half; `starsFor(0.39)=0, (0.4)=1, (0.65)=2, (0.85)=3`; every letter has ≥1 stroke with ≥2 points in range. FAIL.
- [ ] Step 2: e2e: open guided cat-level-1 drawing, press next without drawing on all steps → reaches end screen, stars shown, no errors; "Colorea tu dibujo" lands in color mode with canvas. FAIL then implement.
- [ ] Step 3: Pass; visual check; commit `feat(web): Dibuja conmigo y letras guiadas`.

### Task 8: Foto → colorear v2

**Files:**
- Modify: `server/web/core/lineart.js`, `server/web/modes/photo.js`
- Test: `server/test/unit/web-lineart.test.ts`

**Interfaces:**
- Produces: `photoToLineart(rgba, w, h, { detail = 0.5, thickness = 2 }) → { mask, threshold }` using Sobel + hysteresis (high = Otsu·(1.6−detail), low = high·0.5) + dilate(thickness) + remove components < 0.0004·w·h px. Keeps old positional signature working (`manualThreshold` number → treated as high).
- [ ] Step 1: Tests: square photo with a drawn circle → mask ring closed (inside region ≠ outside region via `labelRegions`); isolated noise pixels removed; portrait 600×1200 input handled (photo.js pads to square — covered by e2e). FAIL.
- [ ] Step 2: Implement + UI sliders "Detalle" and "Grosor", centered square crop with drag to reposition. Pass; commit `feat(web): foto a colorear con bordes limpios`.

### Task 9: Cuentos + Galería polish

**Files:**
- Modify: `server/web/modes/story.js`, `server/web/modes/gallery.js`
- Test: `tests-e2e/specs/flows.spec.ts`

- [ ] Step 1: e2e: create story, delete it from the list (button `[data-testid="story-delete"]`) → gone; gallery "Abrir" on a drawing → Draw mode loaded with its strokes. FAIL.
- [ ] Step 2: Implement: cover card per story (thumbnail of page 1), page-turn animation, caption placeholder "Había una vez…" / "Once upon a time…", visible delete with confirm; gallery cards with open/share/delete, open-to-edit sets setting `drawDraft` then `app.go('draw')`.
- [ ] Step 3: Pass; commit `feat(web): cuentos y galería v2`.

### Task 10: Versioning, SW, offline

**Files:**
- Modify: `server/web/sw.js` (PRECACHE incl. new modules + `/v1/catalog` packs), `server/web/bootcheck.js`, `server/web/index.html`, all `?v=8` → `?v=9`, `package.json` 2.0.0, `CHANGELOG.md`, `README.md` (features/test counts)
- Test: existing offline e2e

- [ ] Step 1: `grep -rn "v=8" server/web` returns nothing; offline e2e passes; full `npm test` + `npx playwright test` pass. Commit `chore: v2.0.0`.

### Task 11: APK build

**Files:**
- Modify: `android/app/build.gradle.kts` (versionCode 4, versionName "2.0.0")

- [ ] Step 1: `cd android && ./gradlew assembleRelease` → BUILD SUCCESSFUL; `apksigner verify` (or `jarsigner -verify`) OK on `app/build/outputs/apk/release/*.apk`.
- [ ] Step 2: Copy to `../Pintakids-v2.0.0.apk`; if a device/emulator is available, install and smoke-test offline (draw, color, guided). Commit `build(android): 2.0.0`.
