/** Celebración breve al terminar un dibujo: confeti (o estrellas quietas si se reduce el movimiento). */

const COLORS = ['#ff7675', '#fdcb6e', '#00b894', '#0984e3', '#6c5ce7', '#fd79a8'];

export function celebrate(message = '') {
  const layer = document.createElement('div');
  layer.className = 'celebrate';
  layer.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const badge = document.createElement('div');
  badge.className = 'celebrate-badge';
  badge.textContent = message;
  layer.append(canvas, badge);
  document.body.appendChild(layer);

  const w = (canvas.width = innerWidth);
  const h = (canvas.height = innerHeight);
  const c = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bits = Array.from({ length: still ? 18 : 120 }, (_, i) => ({
    x: still ? (w / 18) * i + 10 : w / 2,
    y: still ? h * 0.3 : h * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 12,
    r: Math.random() * Math.PI,
    s: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
  }));

  const draw = () => {
    c.clearRect(0, 0, w, h);
    for (const b of bits) {
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.r);
      c.fillStyle = b.color;
      c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      c.restore();
    }
  };

  const end = () => layer.remove();
  if (still) {
    draw();
    setTimeout(end, 1400);
    return;
  }
  const t0 = performance.now();
  const tick = (t) => {
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.45;
      b.vx *= 0.99;
      b.r += 0.15;
    }
    draw();
    if (t - t0 < 1800) requestAnimationFrame(tick);
    else end();
  };
  requestAnimationFrame(tick);
}
