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
 * Generate a payment receipt PDF — desain modern & profesional,
 * memakai identitas bisnis dari pengaturan (nama, kontak, logo,
 * tanda tangan digital, label kwitansi).
 */
export async function generateKwitansiPDF(
  {
    namaPenyewa,
    tanggalMasuk,
    nominal,
    tanggal,
    logoBase64,
    kamar,
    metodePembayaran,
    bulanSewa,
    periodeSewa: periodeSewaOverride,
    wifiDevices,
    wifiFee,
    biayaKamar,
  }: {
    namaPenyewa: string;
    tanggalMasuk: string; // format yyyy-mm-dd
    nominal: string;
    tanggal: string; // tanggal pembayaran, format yyyy-mm-dd
    logoBase64: string;
    kamar: string;
    metodePembayaran: string;
    bulanSewa?: string;
    periodeSewa?: string; // bila diisi (format "1 Agustus 2026 - 3 Agustus 2026"), dipakai langsung
    wifiDevices?: number;
    wifiFee?: number;
    biayaKamar?: string;
  },
  overrides?: { brand?: BrandSettings }
): Promise<{ doc: jsPDF; periodeSewa: string }> {
  const doc = new jsPDF();

  // ---- Identitas dari pengaturan (boleh ditimpa untuk pratinjau) ----
  const brand = overrides?.brand ?? (await fetchBrandSettings());

  // ---- Periode sewa otomatis (dipertahankan dari versi lama) ----
  let computedPeriodeSewa = "";
  try {
    const parseYMD = (s: string) => {
      const [y, m, d] = s.split("-").map((v) => parseInt(v, 10));
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const masuk = parseYMD(tanggalMasuk);
    const bayar = parseYMD(tanggal);
    if (!tanggalMasuk || !tanggal || isNaN(masuk.getTime()) || isNaN(bayar.getTime())) {
      throw new Error("Tanggal tidak valid");
    }

    const monthsMap: { [key: string]: number } = {
      Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5,
      Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11,
    };

    const rentMonth =
      bulanSewa && monthsMap[bulanSewa] !== undefined ? monthsMap[bulanSewa] : bayar.getMonth();

    let rentYear = bayar.getFullYear();
    if (bayar.getMonth() === 11 && rentMonth === 0) rentYear += 1;
    else if (bayar.getMonth() === 0 && rentMonth === 11) rentYear -= 1;

    const mulai = new Date(rentYear, rentMonth, masuk.getDate());
    const akhir = new Date(rentYear, rentMonth + 1, masuk.getDate());

    const formatTanggal = (tgl: Date) =>
      tgl.getDate() + " " + tgl.toLocaleString("id-ID", { month: "long", year: "numeric" });
    computedPeriodeSewa = `${formatTanggal(mulai)} - ${formatTanggal(akhir)}`;
  } catch {
    computedPeriodeSewa = "";
  }

  const periodeSewa = periodeSewaOverride || computedPeriodeSewa || "-";

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
    title: brand.labels.payment.title,
    subtitle: brand.labels.payment.subtitle,
    startY: top + 8,
  });

  const kvRows: [string, string][] = [
    ["Nama Penyewa", namaPenyewa],
    ["Kamar", kamarLabel(kamar)],
    ["Periode Sewa", periodeSewa],
    ["Tanggal Pembayaran", formatTanggalID(tanggal)],
    ["Metode Pembayaran", metodePembayaran],
  ];

  if (wifiDevices && wifiDevices > 0 && wifiFee) {
    if (biayaKamar) {
      kvRows.push(["Biaya Sewa Kamar", biayaKamar]);
    }
    kvRows.push([
      `Tambahan Akses Wi-Fi (${wifiDevices} Perangkat)`,
      `Rp ${wifiFee.toLocaleString("id-ID")}`,
    ]);
  }

  y = kvSection(doc, y, kvRows);

  y = amountBand(doc, y + 4, "Total Pembayaran", nominal);

  const wifiNoteText =
    wifiDevices && wifiDevices > 0
      ? ` dan Tambahan Akses Wi-Fi (${wifiDevices} Perangkat)`
      : "";
  y = noteText(
    doc,
    `Pembayaran sewa periode ${periodeSewa}${wifiNoteText} atas nama ${namaPenyewa} (${kamarLabel(kamar)}) telah diterima.`,
    y + 4
  );
  y += 4;

  const signatureLine = Math.max(y + 10, 192);
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

  drawFooter(doc, brand.labels.payment.footer);
  return { doc, periodeSewa };
}
