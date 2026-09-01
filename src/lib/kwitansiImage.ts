/**
 * Generate a mobile-friendly kwitansi image (PNG) using Canvas API.
 * The image is designed to look clean and modern, perfect for sharing on WhatsApp.
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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

export function generateKwitansiImage(data: KwitansiImageData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = 480; // width
    const H = 720; // height
    const dpr = 2; // retina
    const canvas = document.createElement("canvas");
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));

    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, W, H);

    // Card background
    const cardX = 20;
    const cardY = 16;
    const cardW = W - 40;
    const cardH = H - 32;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Top accent bar
    drawRoundedRect(ctx, cardX, cardY, cardW, 72, 16);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    // Square off bottom of accent bar
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(cardX, cardY + 56, cardW, 16);

    // Logo (if provided)
    let contentStartY = cardY + 90;
    if (data.logoBase64) {
      const logo = new Image();
      logo.src = data.logoBase64;
      // We draw logo synchronously after load by using a trick:
      // Actually for simplicity, skip logo in image version
    }

    // Title on accent bar
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUKTI PEMBAYARAN", W / 2, cardY + 30);
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText("HIRAYA KOST", W / 2, cardY + 50);

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Arial, sans-serif";
    ctx.fillText("Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong", W / 2, cardY + 66);

    // Content
    const leftPad = cardX + 24;
    const rightPad = cardX + cardW - 24;
    let y = contentStartY + 10;

    const drawField = (label: string, value: string) => {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, leftPad, y);
      ctx.fillStyle = "#1e293b";
      ctx.font = "14px Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(value, rightPad, y);
      y += 38;
    };

    drawField("Nama Penyewa", data.namaPenyewa);
    drawField("Kamar", data.kamar);
    drawField("Bulan Sewa", data.bulanSewa);
    drawField("Tanggal Masuk", data.tanggalMasuk);

    // Divider
    y += 4;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(rightPad, y);
    ctx.stroke();
    y += 20;

    // Amount highlight box
    const amountBoxH = 64;
    drawRoundedRect(ctx, leftPad - 4, y - 4, cardW - 40, amountBoxH, 10);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOMINAL PEMBAYARAN", W / 2, y + 16);

    ctx.fillStyle = "#2563eb";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(data.nominal, W / 2, y + 44);

    y += amountBoxH + 20;

    drawField("Tanggal Bayar", data.tanggalBayar);
    drawField("Metode Pembayaran", data.metodePembayaran);

    // Divider
    y += 4;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(rightPad, y);
    ctx.stroke();
    y += 24;

    // LUNAS stamp
    const stampCx = W / 2;
    const stampCy = y + 16;
    const stampR = 36;

    // Circle outline
    ctx.beginPath();
    ctx.arc(stampCx, stampCy, stampR, 0, Math.PI * 2);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // LUNAS text
    ctx.fillStyle = "#16a34a";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LUNAS", stampCx, stampCy - 2);

    // Hiraya Kost under stamp
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Arial, sans-serif";
    ctx.fillText("Hiraya Kost", stampCx, stampCy + 14);

    y += 60;

    // Footer
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Dokumen ini merupakan bukti pembayaran yang sah.", W / 2, y);
    ctx.fillText("Kontak Pengelola: 087722667913", W / 2, y + 16);

    // Convert to blob
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
