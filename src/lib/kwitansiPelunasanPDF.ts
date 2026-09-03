import jsPDF from "jspdf";
import {
  drawBrandHeader,
  docTitleBlock,
  kvSection,
  amountBand,
  noteText,
  signatureColumns,
  stampRound,
  drawFooter,
  formatTanggalID,
} from "./kwitansiUi";
import { drawManagerSignature } from "./kwitansiSign";
import { fetchBrandSettings, imageUrlToDataUrl, type BrandSettings } from "./branding";

/** Rapi-kan label kamar agar tidak dobel: "Kamar 2" / "2" → "Kamar 2". */
function kamarLabel(value: string): string {
  const cleaned = (value || "").trim().replace(/^kamar\s*/i, "");
  return cleaned ? `Kamar ${cleaned}` : "Kamar";
}

/**
 * Generate kwitansi PDF untuk Pelunasan kosan (setelah DP) — desain modern &
 * profesional, memakai identitas bisnis dari pengaturan.
 */
export async function generateKwitansiPelunasanPDF(
  {
    namaPenyewa,
    kamar,
    nominalDP,
    nominalPelunasan,
    totalHarga,
    tanggalPelunasan,
    bulanSewa,
    tanggalMasuk,
    metodePembayaran,
    logoBase64,
  }: {
    namaPenyewa: string;
    kamar: string;
    nominalDP: string;
    nominalPelunasan: string;
    totalHarga: string;
    tanggalPelunasan: string; // yyyy-mm-dd
    bulanSewa: string; // e.g. "Juni"
    tanggalMasuk: string; // yyyy-mm-dd (= tanggal pelunasan = entry_date)
    metodePembayaran: string;
    logoBase64: string;
  },
  overrides?: { brand?: BrandSettings }
): Promise<{ doc: jsPDF; periodeSewa: string }> {
  const doc = new jsPDF();

  const brand = overrides?.brand ?? (await fetchBrandSettings());

  // ---- Periode sewa otomatis (dipertahankan dari versi lama) ----
  let periodeSewa = "";
  try {
    const parseYMD = (s: string) => {
      const [y, m, d] = s.split("-").map((v) => parseInt(v, 10));
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const monthsMap: { [key: string]: number } = {
      Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5,
      Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11,
    };

    const masuk = parseYMD(tanggalMasuk);
    const bayar = parseYMD(tanggalPelunasan);

    const rentMonth =
      bulanSewa && monthsMap[bulanSewa] !== undefined ? monthsMap[bulanSewa] : bayar.getMonth();

    let rentYear = bayar.getFullYear();
    if (bayar.getMonth() === 11 && rentMonth === 0) rentYear += 1;
    else if (bayar.getMonth() === 0 && rentMonth === 11) rentYear -= 1;

    const mulai = new Date(rentYear, rentMonth, masuk.getDate());
    const akhir = new Date(rentYear, rentMonth + 1, masuk.getDate());
    const formatTanggal = (tgl: Date) =>
      tgl.getDate() + " " + tgl.toLocaleString("id-ID", { month: "long", year: "numeric" });
    periodeSewa = `${formatTanggal(mulai)} - ${formatTanggal(akhir)}`;
  } catch {
    periodeSewa = bulanSewa || "-";
  }

  // Logo: utamakan upload dari pengaturan, kalau tidak ada pakai logo bawaan.
  let logo = logoBase64 || undefined;
  if (brand.logo_url) {
    logo = (await imageUrlToDataUrl(brand.logo_url)) || undefined;
  }

  // ---- Tata letak ----
  const top = drawBrandHeader(doc, {
    logoBase64: logo,
    brand: brand.business_name,
    tagline: brand.tagline,
    address: brand.address,
    contact: brand.phone,
  });

  let y = docTitleBlock(doc, {
    title: brand.labels.pelunasan.title,
    subtitle: brand.labels.pelunasan.subtitle,
    startY: top + 8,
  });

  y = kvSection(doc, y, [
    ["Nama Penyewa", namaPenyewa],
    ["Kamar", kamarLabel(kamar)],
    ["Periode Sewa", periodeSewa],
    ["Tanggal Pelunasan", formatTanggalID(tanggalPelunasan)],
    ["Metode Pembayaran", metodePembayaran],
  ]);

  y = kvSection(doc, y, [
    ["DP (dibayar sebelumnya)", nominalDP],
    ["Pelunasan Sekarang", nominalPelunasan],
  ], { highlightRows: [1] });

  y = amountBand(doc, y + 3, "Total Harga Sewa", totalHarga);

  y = noteText(
    doc,
    `Pembayaran lunas: ${namaPenyewa} (${kamarLabel(kamar)}) telah menjadi penghuni aktif.`,
    y + 4
  );
  y += 4;

  const signatureLine = Math.max(y + 10, 195);
  signatureColumns(doc, signatureLine, { left: "Penerima", right: "Pengelola Kost" });

  // Tanda tangan digital (jika diunggah) tetap disertai stempel bulat.
  if (brand.signature_url) {
    const sig = await imageUrlToDataUrl(brand.signature_url);
    if (sig) {
      drawManagerSignature(doc, sig, { centerX: 150, lineY: signatureLine, maxWidth: 42 });
    }
  }
  stampRound(doc, 174, signatureLine - 11, {
    text: "LUNAS",
    sub: brand.business_name,
    radius: 15,
  });

  drawFooter(doc, brand.labels.pelunasan.footer);

  return { doc, periodeSewa };
}
