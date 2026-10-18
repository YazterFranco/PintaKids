/** Iconos SVG inline para Pintakids — stroke currentColor, 2.2px round, sin emojis. */

const svg = (path, size = 24) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

// ── Tabs ──────────────────────────────────────────────────────
export const tabDraw = svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>');
export const tabColor = svg('<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.17-.64-1.6-.4-.42-.63-.98-.63-1.6C13.23 15.12 14.35 14 15.75 14H18c2.21 0 4-1.79 4-4 0-5.52-4.48-10-10-10z"/><circle cx="7" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="10.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.5" fill="currentColor" stroke="none"/>');
export const tabLearn = svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');
export const tabPhoto = svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
export const tabStory = svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
export const tabGallery = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>');
export const tabParents = svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');

// ── Star / score ──────────────────────────────────────────────
export const starIcon = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 18);

// ── Drawing tools ─────────────────────────────────────────────
export const crayonIcon = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><path d="M14 7l3 3"/>');
export const markerIcon = svg('<path d="M18 3l3 3L8 19l-4 1 1-4z"/><path d="M15 6l3 3"/>');
export const pencilIcon = svg('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>');
export const watercolorIcon = svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>');
export const glitterIcon = svg('<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>');
export const sprayIcon = svg('<circle cx="8" cy="8" r="2"/><circle cx="14" cy="6" r="1.5"/><circle cx="17" cy="10" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7" cy="14" r="1.5"/><path d="M19 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1V5a2 2 0 0 1 2-2z" fill="currentColor" stroke="none"/>');
export const rainbowIcon = svg('<path d="M2 18a10 10 0 0 1 20 0"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M8 18a4 4 0 0 1 8 0"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>');
export const rectIcon = svg('<rect x="3" y="3" width="18" height="18" rx="2"/>');
export const ellipseIcon = svg('<ellipse cx="12" cy="12" rx="10" ry="7"/>');
export const lineIcon = svg('<path d="M5 19L19 5"/>');
export const starToolIcon = svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
export const fillIcon = svg('<path d="M7 22h10"/><path d="M5.17 14.83L2 12l10-10 10 10-3.17 3.17"/><path d="M12 2v10"/><path d="M17 14l3 4a2 2 0 0 1-3 2l-3-4"/>');
export const pickerIcon = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>');
export const eraserIcon = svg('<path d="M7 21l-4.5-4.5a2 2 0 0 1 0-2.83l8.66-8.66a2 2 0 0 1 2.83 0L20.83 9.5a2 2 0 0 1 0 2.83L12 21H7z"/><path d="M7 21h14"/>');
export const stampIcon = svg('<path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L14 14h-4l1.25-4.07C9.4 9.58 8 7.95 8 6a4 4 0 0 1 4-4z" fill="currentColor" stroke="none"/><path d="M4 18h16"/><path d="M6 22h12"/>');

// ── Actions ───────────────────────────────────────────────────
export const undoIcon = svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>');
export const redoIcon = svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>');
export const mirrorIcon = svg('<path d="M12 3v18"/><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>');
export const exportIcon = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>');
export const clearIcon = svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>');
export const saveIcon = svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
export const brushIcon = svg('<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>');
export const downloadIcon = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>');
export const backIcon = svg('<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>');
export const nextIcon = svg('<path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>');

// ── Overlay ───────────────────────────────────────────────────
export const clockIcon = svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 76);
export const crayonLogo = svg('<path d="M2 22l1-4L16.5 4.5a2.121 2.121 0 0 1 3 3L7 20l-4 1z"/><path d="M14 7l3 3"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>', 28);
