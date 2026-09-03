import jsPDF from "jspdf";
import {
  drawBrandHeader,
  docTitleBlock,
  kvSection,
  noteText,
  signatureColumns,
  stampRound,
  drawFooter,
  formatTanggalID,
  PALETTE,
} from "./kwitansiUi";
import { drawManagerSignature } from "./kwitansiSign";
import { fetchBrandSettings, imageUrlToDataUrl, type BrandSettings } from "./branding";

/**
 * Generate kwitansi PDF untuk Down Payment (DP) — desain modern & profesional,
 * memakai identitas bisnis dari pengaturan.
 */
export async function generateKwitansiDPPDF(
  {
    namaCalon,
    kamar,
    nominalDP,
    sisaPelunasan,
    totalHarga,
    tanggalDP,
    deadlinePelunasan,
    metodePembayaran,
    logoBase64,
  }: {
    namaCalon: string;
    kamar: string;
    nominalDP: string;
    sisaPelunasan: string;
    totalHarga: string;
    tanggalDP: string; // yyyy-mm-dd
    deadlinePelunasan: string; // yyyy-mm-dd
    metodePembayaran: string;
    logoBase64: string;
  },
  overrides?: { brand?: BrandSettings }
): Promise<{ doc: jsPDF }> {
  const doc = new jsPDF();

  const brand = overrides?.brand ?? (await fetchBrandSettings());

  let logo = logoBase64 || undefined;
  if (brand.logo_url) {
    logo = (await imageUrlToDataUrl(brand.logo_url)) || undefined;
  }

  const top = drawBrandHeader(doc, {
    logoBase64: logo,
    brand: brand.business_name,
    tagline: brand.tagline,
    address: brand.address,
    contact: brand.phone,
  });

  let y = docTitleBlock(doc, {
    title: brand.labels.dp.title,
    subtitle: brand.labels.dp.subtitle,
    startY: top + 8,
  });

  y = kvSection(doc, y, [
    ["Nama Calon Penyewa", namaCalon],
    ["Kamar", kamar],
    ["Tanggal DP", formatTanggalID(tanggalDP)],
    ["Deadline Pelunasan", formatTanggalID(deadlinePelunasan)],
    ["Metode Pembayaran", metodePembayaran],
  ]);

  y = kvSection(doc, y, [
    ["Total Harga Sewa", totalHarga],
    ["Nominal DP", nominalDP],
    ["Sisa Pelunasan", sisaPelunasan],
  ], { highlightRows: [1] });

  y += 3;
  y = noteText(
    doc,
    `* Mohon lakukan pelunasan sebelum ${formatTanggalID(deadlinePelunasan)}. DP akan hangus apabila melewati batas waktu.`,
    y,
    { color: PALETTE.red, fontSize: 8.6 }
  );
  y += 4;

  const signatureLine = Math.max(y + 8, 195);
  signatureColumns(doc, signatureLine, { left: "Penerima", right: "Pengelola Kost" });

  // Tanda tangan digital (jika diunggah) tetap disertai stempel bulat.
  if (brand.signature_url) {
    const sig = await imageUrlToDataUrl(brand.signature_url);
    if (sig) {
      drawManagerSignature(doc, sig, { centerX: 150, lineY: signatureLine, maxWidth: 42 });
    }
  }
  stampRound(doc, 174, signatureLine - 11, {
    text: "DP",
    sub: brand.business_name,
    color: PALETTE.orange,
    radius: 14,
  });

  drawFooter(doc, brand.labels.dp.footer);

  return { doc };
}
