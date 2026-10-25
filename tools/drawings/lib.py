"""Ayudas para escribir dibujos del catálogo (solo herramienta de autor; no se publica)."""
import math, json
H = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="#fff" stroke="#2b2d42" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">'
def g(n, name, body): return f'  <g data-step="{n}" data-name="{name}">\n{body}\n  </g>\n'
def svg(*groups): return H + '\n' + ''.join(groups) + '</svg>\n'
def scallop(cx, cy, rx, ry, n, rb, start=0.0):
    pts = [(cx + rx * math.cos(start + 2 * math.pi * k / n), cy + ry * math.sin(start + 2 * math.pi * k / n)) for k in range(n)]
    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
    for k in range(1, n + 1):
        x, y = pts[k % n]; d += f" A{rb} {rb} 0 0 1 {x:.1f} {y:.1f}"
    return d + " Z"
def star(cx, cy, R, r, n=5, round_=0.2, rot=-math.pi / 2):
    O = [(cx + R * math.cos(rot + 2 * math.pi * i / n), cy + R * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]
    I = [(cx + r * math.cos(rot + math.pi / n + 2 * math.pi * i / n), cy + r * math.sin(rot + math.pi / n + 2 * math.pi * i / n)) for i in range(n)]
    lerp = lambda a, b, t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    d = ''
    for i in range(n):
        a = lerp(O[i], I[i - 1], round_); b = lerp(O[i], I[i], round_)
        d += (f"M{a[0]:.1f} {a[1]:.1f}" if i == 0 else f" L{a[0]:.1f} {a[1]:.1f}") + f" Q{O[i][0]:.1f} {O[i][1]:.1f} {b[0]:.1f} {b[1]:.1f} L{I[i][0]:.1f} {I[i][1]:.1f}"
    return d + ' Z'
def steps(*a): return [{"key": a[i], "es": a[i + 1], "en": a[i + 2]} for i in range(0, len(a), 3)]
def write(files, pack):
    for k, v in files.items(): open(k + '.svg', 'w').write(v)
    json.dump(pack, open('pack.json', 'w'), ensure_ascii=False, indent=2)
def ribbon(center, w0, w1):
    """Contorno cerrado de una tira de ancho w0→w1 a lo largo de una polilínea (tentáculos, colas, tallos)."""
    n = len(center); L = []; R = []
    for i, (x, y) in enumerate(center):
        a = center[max(0, i - 1)]; b = center[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        L.append((x + nx * w, y + ny * w)); R.append((x - nx * w, y - ny * w))
    pts = L + R[::-1]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
def wavy(x0, y0, x1, y1, amp=10, waves=1.5, curl=0, curl_r=12, steps=28):
    """Polilínea ondulada de (x0,y0) a (x1,y1); curl=±1 añade un rizo al final."""
    pts = []
    dx, dy = x1 - x0, y1 - y0; ln = math.hypot(dx, dy); nx, ny = -dy / ln, dx / ln
    for i in range(steps + 1):
        t = i / steps; s = amp * math.sin(t * waves * 2 * math.pi) * t
        pts.append((x0 + dx * t + nx * s, y0 + dy * t + ny * s))
    if curl:
        ang = math.atan2(dy, dx)
        cx = x1 + curl * curl_r * math.cos(ang + math.pi / 2); cy = y1 + curl * curl_r * math.sin(ang + math.pi / 2)
        a0 = math.atan2(y1 - cy, x1 - cx)
        for k in range(1, 13):
            a = a0 + curl * k * (math.pi * 1.4) / 12
            r = curl_r * (1 - k / 30)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
