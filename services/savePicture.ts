import { saveFile } from './backup';

/** Draws an on-screen SVG into a PNG (at twice its size, for a sharp picture) and hands it to the user to save or share. */
export async function saveSvgAsPng(svg: SVGSVGElement, name: string): Promise<void> {
  const box = svg.viewBox.baseVal, w = box.width * 2, h = box.height * 2;
  const markup = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  await saveFile(`${name.replace(/[^\w -]+/g, '').replace(/\s+/g, '_') || 'diagram'}.png`, { base64 }, 'image/png', name);
}
