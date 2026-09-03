import jsPDF from "jspdf";
import { pngSizeFromDataUrl } from "./branding";

/**
 * Gambar tanda tangan digital (PNG, idealnya transparan) di atas garis
 * tanda tangan pengelola. Dasar gambar menyentuh garis, proporsi asli
 * dipertahankan dan tinggi dibatasi agar tidak menutupi nama di bawah.
 */
export function drawManagerSignature(
  doc: jsPDF,
  base64: string,
  opts: { centerX: number; lineY: number; maxWidth?: number }
): boolean {
  const { centerX, lineY, maxWidth = 46 } = opts;
  const size = pngSizeFromDataUrl(base64);

  let w = maxWidth;
  let h = 22;
  if (size && size.w > 0 && size.h > 0) {
    const ratio = size.h / size.w;
    const hMax = 28;
    if (w * ratio > hMax) w = Math.round(hMax / ratio);
    h = Math.round(w * ratio);
  }
  if (h <= 0 || w <= 0) return false;

  try {
    doc.addImage(base64, "PNG", centerX - w / 2, lineY - h - 2, w, h);
    return true;
  } catch {
    return false;
  }
}
