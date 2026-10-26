/** Iconos SVG inline kawaii — stroke grueso, rellenos suaves, estilo sticker para niños. */

const svg = (path, size = 28, fill = 'currentColor') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

// ── Tabs ──────────────────────────────────────────────────────
export const tabDraw = svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', 28);
export const tabColor = svg('<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.17-.64-1.6-.4-.42-.63-.98-.63-1.6C13.23 15.12 14.35 14 15.75 14H18c2.21 0 4-1.79 4-4 0-5.52-4.48-10-10-10z"/><circle cx="7" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="10.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="currentColor" stroke="none"/>', 28);
export const tabLearn = svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', 28);
export const tabPhoto = svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', 28);
export const tabStory = svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 28, 'none');
export const tabGallery = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', 28);
export const tabParents = svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 28);

// ── Star / score ──────────────────────────────────────────────
export const starIcon = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 22, '#ffd166');

// ── Drawing tools (gruesos y kawaii) ──────────────────────────
export const crayonIcon = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><path d="M14 7l3 3"/>', 28);
export const markerIcon = svg('<path d="M18 3l3 3L8 19l-4 1 1-4z"/><path d="M15 6l3 3"/>', 28);
export const pencilIcon = svg('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>', 28);
export const watercolorIcon = svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', 28, '#a8e6ff');
export const glitterIcon = svg('<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>', 28, '#ffe082');
export const sprayIcon = svg('<circle cx="8" cy="8" r="2"/><circle cx="14" cy="6" r="1.5"/><circle cx="17" cy="10" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7" cy="14" r="1.5"/><path d="M19 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1V5a2 2 0 0 1 2-2z" fill="currentColor" stroke="none"/>', 28);
export const rainbowIcon = svg('<path d="M2 18a10 10 0 0 1 20 0"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M8 18a4 4 0 0 1 8 0"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>', 28);
export const rectIcon = svg('<rect x="3" y="3" width="18" height="18" rx="2"/>', 28);
export const ellipseIcon = svg('<ellipse cx="12" cy="12" rx="10" ry="7"/>', 28);
export const lineIcon = svg('<path d="M5 19L19 5"/>', 28);
export const starToolIcon = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 28);
export const fillIcon = svg('<path d="M7 22h10"/><path d="M5.17 14.83L2 12l10-10 10 10-3.17 3.17"/><path d="M12 2v10"/><path d="M17 14l3 4a2 2 0 0 1-3 2l-3-4"/>', 28);
export const pickerIcon = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>', 28);
export const eraserIcon = svg('<path d="M7 21l-4.5-4.5a2 2 0 0 1 0-2.83l8.66-8.66a2 2 0 0 1 2.83 0L20.83 9.5a2 2 0 0 1 0 2.83L12 21H7z"/><path d="M7 21h14"/>', 28);
export const stampIcon = svg('<path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L14 14h-4l1.25-4.07C9.4 9.58 8 7.95 8 6a4 4 0 0 1 4-4z" fill="currentColor" stroke="none"/><path d="M4 18h16"/><path d="M6 22h12"/>', 28);

// ── Actions ───────────────────────────────────────────────────
export const undoIcon = svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', 28);
export const redoIcon = svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>', 28);
export const mirrorIcon = svg('<path d="M12 3v18"/><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>', 28);
export const exportIcon = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', 28);
export const clearIcon = svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 28);
export const saveIcon = svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', 28);
export const brushIcon = svg('<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>', 28);
export const downloadIcon = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 28);
export const backIcon = svg('<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>', 28);
export const nextIcon = svg('<path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>', 28);

// ── Overlay ───────────────────────────────────────────────────
export const clockIcon = svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 80);
export const crayonLogo = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><path d="M14 7l3 3"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>', 34);

// ── v2: barra superior ────────────────────────────────────────
export const homeIcon = svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>', 26, 'none');
export const lockIcon = svg('<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 22, 'none');
export const colorPencilIcon = svg('<path d="M15 4l5 5L9 20H4v-5z"/><path d="M4 15l5 5"/><path d="M13 6l5 5"/>', 28, 'none');
export const chalkIcon = svg('<rect x="3" y="9" width="18" height="7" rx="2" transform="rotate(-25 12 12.5)"/><path d="M4 21h4M10 21h2M15 21h3" />', 28, 'none');
export const neonIcon = svg('<path d="M4 16c3-8 6 4 9-4s5 0 7-2"/><circle cx="20" cy="10" r="1.5" fill="currentColor" stroke="none"/>', 28, 'none');
export const shareIcon = svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>', 26, 'none');
export const bgIcon = svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 15l5-5 4 4 3-3 6 6"/>', 26, 'none');
export const zoomResetIcon = svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6"/>', 26, 'none');

// ── v2: iconos ilustrados de la barra de pinceles (a color, 32×32) ─────────
const art = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 32 32" stroke="#2d3436" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const RAIL_ART = {
  crayon: art('<g transform="rotate(45 16 16)"><path d="M12 9h8v17h-8z" fill="#ff7675"/><path d="M12 9l4-6 4 6z" fill="#ff7675"/><path d="M12 13h8M12 22h8" stroke="#fff" stroke-width="1.6"/></g>'),
  colorpencil: art('<g transform="rotate(45 16 16)"><path d="M12.5 8h7v19h-7z" fill="#74b9ff"/><path d="M12.5 8l3.5-6 3.5 6z" fill="#ffeaa7"/><path d="M15 4.3l1-1.7 1 1.7z" fill="#0984e3"/></g>'),
  marker: art('<g transform="rotate(45 16 16)"><path d="M11 12h10v16H11z" fill="#00b894"/><path d="M13 12l1.2-6h3.6l1.2 6z" fill="#dfe6e9"/><path d="M14.2 6l.6-3h2.4l.6 3z" fill="#00b894"/></g>'),
  watercolor: art('<path d="M7 25c3-1 4-4 6-6l3 3c-2 2-5 3-9 3z" fill="#a29bfe"/><path d="M13 19L24 6l2 2-11 13z" fill="#d4a373"/><path d="M24 22a3 3 0 1 1-6 0c0-2 3-5 3-5s3 3 3 5z" fill="#a29bfe" stroke="none" opacity=".7"/>'),
  chalk: art('<rect x="3" y="6" width="26" height="20" rx="4" fill="#2f3e3a"/><path d="M8 20c3-5 5 2 8-3s4-1 6-3" stroke="#fff" stroke-dasharray="1.5 1.5"/><rect x="18" y="20" width="8" height="3" rx="1.2" fill="#fff" stroke="none"/>'),
  neon: art('<path d="M5 20c4-10 7 4 11-4s7 2 11-6" stroke="#55efc4" stroke-width="5" opacity=".45"/><path d="M5 20c4-10 7 4 11-4s7 2 11-6" stroke="#00b894" stroke-width="2.4"/><path d="M5 20c4-10 7 4 11-4s7 2 11-6" stroke="#fff" stroke-width=".9"/>'),
  glitter: art('<path d="M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fdcb6e"/><path d="M24 17l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fd79a8"/><circle cx="23" cy="8" r="1.6" fill="#a29bfe" stroke="none"/>'),
  spray: art('<rect x="9" y="12" width="11" height="16" rx="3" fill="#0984e3"/><rect x="11" y="7" width="7" height="5" rx="1.5" fill="#dfe6e9"/><g fill="#0984e3" stroke="none"><circle cx="24" cy="6" r="1.2"/><circle cx="27" cy="9" r="1"/><circle cx="23" cy="10" r="1"/><circle cx="27" cy="4" r=".9"/></g>'),
  rainbow: art('<path d="M4 24a12 12 0 0 1 24 0" stroke="#ff7675" stroke-width="3.2" fill="none"/><path d="M8 24a8 8 0 0 1 16 0" stroke="#fdcb6e" stroke-width="3.2" fill="none"/><path d="M12 24a4 4 0 0 1 8 0" stroke="#0984e3" stroke-width="3.2" fill="none"/>'),
  stamp: art('<path d="M16 3l2.4 5 5.4.6-4 3.7 1.1 5.4L16 15l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" fill="#fdcb6e"/><path d="M6 24h20v4H6z" fill="#e17055"/><path d="M12 18h8v6h-8z" fill="#fab1a0"/>'),
  rect: art('<rect x="6" y="8" width="20" height="16" rx="3" fill="none" stroke-width="2.4"/>'),
  ellipse: art('<ellipse cx="16" cy="16" rx="11" ry="8" fill="none" stroke-width="2.4"/>'),
  line: art('<path d="M6 26L26 6" stroke-width="2.6"/>'),
  star: art('<path d="M16 4l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9L16 22l-7 3.8 1.3-7.9-5.7-5.6 7.9-1.1z" fill="none" stroke-width="2.2"/>'),
  fill: art('<path d="M6 15l9-9 9 9-9 9z" fill="#dfe6e9"/><path d="M8 17h14l-7 7z" fill="#6c5ce7" stroke="none"/><path d="M27 22a2.5 2.5 0 1 1-5 0c0-1.8 2.5-4.5 2.5-4.5s2.5 2.7 2.5 4.5z" fill="#6c5ce7"/>'),
  picker: art('<path d="M7 25l1-4 10-10 3 3-10 10z" fill="#dfe6e9"/><path d="M18 11l3-3a2.8 2.8 0 0 1 4 4l-3 3z" fill="#2d3436"/><path d="M7 25l1-4 4 4z" fill="#ff7675" stroke="none"/>'),
  eraser: art('<g transform="rotate(-40 16 16)"><rect x="6" y="11" width="20" height="10" rx="2.5" fill="#fd79a8"/><path d="M15 11v10" /><rect x="15" y="11" width="11" height="10" rx="2.5" fill="#dfe6e9"/></g>'),
};
export const checkIcon = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 26, 'none');
