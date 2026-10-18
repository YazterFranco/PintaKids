/** Voz: usa el TTS del sistema (navegador/WebView). Silencioso si el niño lo apaga. */

let voices = [];

function refreshVoices() {
  if ('speechSynthesis' in window) voices = speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}

function enabled(ctx) {
  return ctx?.app?.settings?.sound !== 'off';
}

export function speak(text, lang = 'es', ctx) {
  if (!('speechSynthesis' in window) || !enabled(ctx) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'es-MX';
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch {
    /* sin voz no pasa nada: el niño sigue dibujando */
  }
}
