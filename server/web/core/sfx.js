/** Efectos de sonido cortos generados con WebAudio (sin archivos). Se apagan desde Padres. */

const SOUNDS = {
  tap: [[660, 0.05, 'sine']],
  pop: [[520, 0.05, 'triangle'], [880, 0.07, 'triangle']],
  fill: [[392, 0.06, 'sine'], [523, 0.09, 'sine']],
  star: [[784, 0.08, 'triangle'], [988, 0.08, 'triangle'], [1319, 0.16, 'triangle']],
};

let ac = null;
let enabled = true;

export const sfx = {
  setEnabled(v) {
    enabled = v !== false;
  },
  play(name) {
    const notes = SOUNDS[name];
    if (!enabled || !notes) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const [freq, dur, type] of notes) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
        t += dur * 0.8;
      }
    } catch {
      /* sin audio: la app sigue igual */
    }
  },
};
