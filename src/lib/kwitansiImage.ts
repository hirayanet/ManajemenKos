/**
 * Generate a mobile-friendly kwitansi image (PNG) using Canvas API.
 * Bold, badge-driven design for maximum readability on mobile.
 */

interface KwitansiImageData {
  namaPenyewa: string;
  kamar: string;
  bulanSewa: string;
  nominal: string;
  tanggalBayar: string;
  metodePembayaran: string;
  tanggalMasuk: string;
  logoBase64?: string;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw a badge pill: colored background + white bold text */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  bgColor: string,
  textColor: string,
  fontSize: number
) {
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const textW = ctx.measureText(text).width;
  const padX = 14;
  const padY = 7;
  const bw = textW + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = cx - bw / 2;
  const by = cy - bh / 2;

  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
  ctx.textBaseline = "alphabetic";
}

/** Draw a bold label + value row */
function drawBoldField(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  leftX: number,
  rightX: number,
  y: number
) {
  // Label — small, muted, uppercase
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label.toUpperCase(), leftX, y);

  // Value — large, dark, bold
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(value, rightX, y);
}

export function generateKwitansiImage(data: KwitansiImageData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = 500;
    const H = 780;
    const dpr = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));
    ctx.scale(dpr, dpr);

    // ── Background ──
    ctx.fillStyle = "#eef2f7";
    ctx.fillRect(0, 0, W, H);

    // ── Card ──
    const cx = 16, cy = 16, cw = W - 32, ch = H - 32;
    roundRect(ctx, cx, cy, cw, ch, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // ── Header bar (blue gradient) ──
    const hdrH = 90;
    roundRect(ctx, cx, cy, cw, hdrH, 20);
    ctx.fillStyle = "#1d4ed8";
    ctx.fill();
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(cx, cy + 70, cw, 20);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.fillText("BUKTI PEMBAYARAN", W / 2, cy + 34);
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillStyle = "#bfdbfe";
    ctx.fillText("HIRAYA KOST", W / 2, cy + 56);

    // Address
    ctx.fillStyle = "#93c5fd";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText("Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong", W / 2, cy + 76);

    // ── Content area ──
    const padX = cx + 28;
    const padR = cx + cw - 28;
    let y = cy + hdrH + 20;

    // Fields
    drawBoldField(ctx, "Nama Penyewa", data.namaPenyewa, padX, padR, y); y += 40;
    drawBoldField(ctx, "Kamar", data.kamar, padX, padR, y); y += 40;
    drawBoldField(ctx, "Bulan Sewa", data.bulanSewa, padX, padR, y); y += 40;
    drawBoldField(ctx, "Tanggal Masuk", data.tanggalMasuk, padX, padR, y); y += 10;

    // ── Divider ──
    y += 10;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padR, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 20;

    // ── Amount highlight box ──
    const amtH = 80;
    roundRect(ctx, padX - 8, y - 4, cw - 48, amtH, 12);
    ctx.fillStyle = "#dbeafe";
    ctx.fill();
    // Blue left accent bar
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(padX - 8, y + 4, 5, amtH - 16);

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOMINAL PEMBAYARAN", W / 2, y + 22);

    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillText(data.nominal, W / 2, y + 56);

    y += amtH + 16;

    // More fields
    drawBoldField(ctx, "Tanggal Bayar", data.tanggalBayar, padX, padR, y); y += 40;
    drawBoldField(ctx, "Metode Pembayaran", data.metodePembayaran, padX, padR, y); y += 10;

    // ── Badge row ──
    y += 16;
    const badgeY = y + 12;
    drawBadge(ctx, "LUNAS", W / 2, badgeY, "#16a34a", "#ffffff", 16);
    y += 44;

    // ── Divider ──
    y += 8;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padR, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 24;

    // ── Signature area ──
    const sigRightX = padR - 10;
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Pengelola Kost", sigRightX, y); y += 8;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sigRightX - 100, y + 18);
    ctx.lineTo(sigRightX, y + 18);
    ctx.stroke();
    y += 36;

    // ── Footer ──
    y += 10;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Dokumen ini merupakan bukti pembayaran yang sah.", W / 2, y);
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Kontak Pengelola: 087722667913", W / 2, y + 18);

    // ── Convert to blob ──
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate image"));
      },
      "image/png",
      1.0
    );
  });
}

/**
 * Download the kwitansi image as PNG
 */
export async function downloadKwitansiImage(
  data: KwitansiImageData,
  fileName: string
) {
  const blob = await generateKwitansiImage(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
