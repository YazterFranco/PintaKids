/** Compartir o guardar una imagen: hoja nativa → puente Android → descarga. */

export async function shareBlob(blob, name, toast) {
  const fileName = (name || 'pintakids') + '.png';
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Pintakids' });
      return;
    } catch {
      /* cancelado: seguir con el plan B */
    }
  }
  if (window.PintakidsBridge?.saveImage) {
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
    window.PintakidsBridge.saveImage(String(dataUrl), fileName);
    toast?.('📲');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const canvasBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

/** Encaja `src` en un cuadrado de `size` px (para miniaturas sin deformar). */
export function squareThumb(src, size = 300, bg = '#ffffff') {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const c = out.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, size, size);
  const k = Math.min(size / src.width, size / src.height);
  const w = src.width * k;
  const h = src.height * k;
  c.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  return out.toDataURL('image/png');
}
