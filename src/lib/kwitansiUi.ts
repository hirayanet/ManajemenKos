import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Palet desain bersama untuk seluruh kwitansi PDF
export const PALETTE = {
  navy: [30, 58, 138] as const, // #1e3a8a — band header
  blue: [37, 99, 235] as const, // #2563eb — aksen utama
  blueLight: [239, 246, 255] as const, // #eff6ff — latar band nominal
  blueBorder: [191, 219, 254] as const, // #bfdbfe
  orange: [234, 88, 12] as const, // #ea580c — aksen DP
  ink: [51, 65, 85] as const, // #334155
  muted: [100, 116, 139] as const, // #64748b
  line: [226, 232, 240] as const, // #e2e8f0
  surface: [248, 250, 252] as const, // #f8fafc
  white: [255, 255, 255] as const,
  slate300: [203, 213, 225] as const, // #cbd5e1
  red: [220, 38, 38] as const, // #dc2626
};

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-09-03" → "3 September 2026" */
export function formatTanggalID(ymd?: string | null): string {
  if (!ymd) return "-";
  try {
    const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return ymd;
    return `${d} ${BULAN[(m || 1) - 1]} ${y}`;
  } catch {
    return ymd;
  }
}

type Rgb = readonly number[];

function setColor(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}

// autoTable / jsPDF menerima warna sebagai array yang bisa berubah
function mutable(color: Rgb): [number, number, number] {
  return [color[0], color[1], color[2]];
}

/**
 * Header band biru navy + aksen, logo & identitas kos di kiri,
 * kontak di kanan. Mengembalikan koordinat Y setelah band.
 */
export function drawBrandHeader(
  doc: jsPDF,
  opts: {
    logoBase64?: string;
    brand?: string;
    tagline?: string;
    address?: string;
    contact?: string;
  } = {}
): number {
  const {
    logoBase64,
    brand = "HIRAYA KOST",
    tagline = "Manajemen Kos & Pembayaran",
    address = "Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong",
    contact = "087722667913",
  } = opts;

  const bandH = 30;
  doc.setFillColor(PALETTE.navy[0], PALETTE.navy[1], PALETTE.navy[2]);
  doc.rect(0, 0, 210, bandH, "F");
  // Aksen bawah band
  doc.setFillColor(PALETTE.blue[0], PALETTE.blue[1], PALETTE.blue[2]);
  doc.rect(0, bandH, 210, 2.4, "F");

  // Logo + identitas (kiri)
  let brandX = 14;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 14, 7, 16, 16);
    brandX = 36;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setColor(doc, PALETTE.white);
  doc.text(brand, brandX, 14.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, PALETTE.slate300);
  doc.text(tagline, brandX, 21);

  // Kontak (kanan, rata kanan)
  doc.setFontSize(7);
  doc.text("Kontak Pengelola", 196, 11.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  setColor(doc, PALETTE.white);
  doc.text(contact, 196, 19.5, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Alamat (tipis, di bawah band)
  setColor(doc, PALETTE.muted);
  doc.setFontSize(7.6);
  doc.text(`${address}  •  ${contact}`, 105, bandH + 7.5, { align: "center" });

  return bandH + 2.4;
}

/**
 * Judul dokumen besar di tengah + garis aksen + subtitle.
 */
export function docTitleBlock(
  doc: jsPDF,
  opts: { title: string; subtitle?: string; startY: number }
): number {
  const { title, subtitle, startY } = opts;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setColor(doc, PALETTE.ink);
  doc.text(title, 105, startY + 6, { align: "center" });

  // Garis aksen pendek di bawah judul
  doc.setFillColor(PALETTE.blue[0], PALETTE.blue[1], PALETTE.blue[2]);
  doc.roundedRect(96, startY + 9.5, 18, 1.1, 0.5, 0.5, "F");

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, PALETTE.muted);
    doc.text(subtitle, 105, startY + 15.5, { align: "center" });
  }
  return startY + 19;
}

/**
 * Tabel label → nilai yang rapi (strip lembut, garis tipis).
 * Mengembalikan Y setelah tabel.
 */
export function kvSection(
  doc: jsPDF,
  startY: number,
  rows: [string, string][],
  opts?: {
    highlightRows?: number[]; // index baris yang nilai-nya ditebalkan + berwarna navy
    col1Width?: number;
  }
): number {
  const width = opts?.col1Width ?? 56;
  const highlight = new Set(opts?.highlightRows ?? []);

  autoTable(doc, {
    startY,
    margin: { left: 16, right: 16 },
    theme: "plain",
    body: rows,
    styles: {
      fontSize: 9.6,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      textColor: mutable(PALETTE.ink),
      lineColor: mutable(PALETTE.line),
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: mutable(PALETTE.surface) },
    columnStyles: {
      0: { cellWidth: width, fontStyle: "bold", textColor: mutable(PALETTE.muted) },
    },
    didParseCell: (data) => {
      if (highlight.has(data.row.index) && data.column.index === 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = mutable(PALETTE.navy);
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
  return finalY ? finalY + 2 : startY + rows.length * 12 + 8;
}

/**
 * Band highlight nominal/total: label di kiri, nilai besar biru navy di kanan.
 */
export function amountBand(
  doc: jsPDF,
  startY: number,
  label: string,
  value: string,
  accent: Rgb = PALETTE.blue
): number {
  const h = 15;
  doc.setFillColor(PALETTE.blueLight[0], PALETTE.blueLight[1], PALETTE.blueLight[2]);
  doc.setDrawColor(PALETTE.blueBorder[0], PALETTE.blueBorder[1], PALETTE.blueBorder[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(16, startY, 178, h, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  setColor(doc, PALETTE.muted);
  doc.text(label, 24, startY + 9.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, accent);
  doc.text(value, 186, startY + 9.7, { align: "right" });

  return startY + h + 4;
}

/** Teks catatan kecil (warna bebas), dengan wrap. */
export function noteText(
  doc: jsPDF,
  text: string,
  y: number,
  opts?: { color?: Rgb; x?: number; maxWidth?: number; fontSize?: number }
): number {
  const { color = PALETTE.muted, x = 16, maxWidth = 178, fontSize = 8.5 } = opts ?? {};
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  setColor(doc, color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize + 1.2);
}

/**
 * Kolom tanda tangan dua sisi (kiri: penerima, kanan: pengelola),
 * masing-masing dengan garis putus-putus dan keterangan di bawahnya.
 */
export function signatureColumns(
  doc: jsPDF,
  lineY: number,
  opts: { left?: string; right?: string } = {}
): void {
  const { left = "Penerima", right = "Pengelola Kost" } = opts;
  const half = (center: number) => {
    doc.setDrawColor(PALETTE.muted[0], PALETTE.muted[1], PALETTE.muted[2]);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1.6, 1.6], 0);
    doc.line(center - 30, lineY, center + 30, lineY);
    doc.setLineDashPattern([], 0);
  };
  const caption = (center: number, label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(doc, PALETTE.ink);
    doc.text(label, center, lineY + 5.5, { align: "center" });
  };

  half(50);
  caption(50, left);
  half(160);
  caption(160, right);
}

/** Stempel bundar (ring) berisi teks, mis. "LUNAS" atau "DP". */
export function stampRound(
  doc: jsPDF,
  cx: number,
  cy: number,
  opts: { text: string; sub?: string; color?: Rgb; radius?: number }
): void {
  const { text, sub, color = PALETTE.blue, radius = 15 } = opts;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(1.3);
  doc.circle(cx, cy, radius, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(doc, color);
  doc.text(text, cx, cy + 2.5, { align: "center" });

  if (sub) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    setColor(doc, color);
    doc.text(sub, cx, cy + radius - 3, { align: "center" });
  }
}

/** Garis footer tipis di bagian bawah halaman. */
export function drawFooter(doc: jsPDF, message = "Terima kasih telah membayar tepat waktu."): void {
  setColor(doc, PALETTE.line);
  doc.setLineWidth(0.25);
  doc.line(16, 286, 194, 286);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor(doc, PALETTE.muted);
  doc.text(message, 105, 291, { align: "center" });
  doc.text("Dokumen ini dibuat otomatis — sah tanpa stempel basah", 105, 295, {
    align: "center",
  });
}
