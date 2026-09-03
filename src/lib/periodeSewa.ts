/**
 * Menghitung teks "Periode Sewa" untuk kwitansi (gambar mobile & PDF) supaya
 * preview struk dan hasil unduh selalu konsisten.
 *
 * - Harian : "1 Agustus 2026 - 3 Agustus 2026" — dari kolom periode_mulai/
 *   periode_selesai; fallback mem-parse teks lama "Harian: ..." di payment_month.
 * - Bulanan: "15 Agustus 2026 - 14 September 2026" — rentang dimulai dari hari
 *   tanggal masuk penghuni di bulan yang dibayar, s/d satu bulan berikutnya.
 */

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BULAN_MAP: Record<string, number> = {
  Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5,
  Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11,
};

export interface PeriodeSewaInput {
  payment_month: string;
  payment_date?: string | null;
  entry_date?: string | null;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
}

const parseYMD = (s?: string | null): Date | null => {
  if (!s) return null;
  const parts = s.split("-").map((v) => parseInt(v, 10));
  if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  // Pastikan tanggal valid (mis. 31 Februari akan melompat & tidak cocok)
  if (d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2]) return null;
  return d;
};

const fmtTgl = (d: Date) => `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;

export function formatPeriodeSewa(input: PeriodeSewaInput): string {
  const { payment_month } = input;

  // 1) Harian dengan kolom periode terstruktur
  const mulai = parseYMD(input.periode_mulai);
  const selesai = parseYMD(input.periode_selesai);
  if (mulai && selesai && selesai.getTime() >= mulai.getTime()) {
    return `${fmtTgl(mulai)} - ${fmtTgl(selesai)}`;
  }

  // 2) Harian lama: teks "Harian: 1 Agustus 2026 - 3 Agustus 2026"
  const harian = /^Harian:\s*(.+)$/i.exec(payment_month || "");
  if (harian) {
    const teks = harian[1].trim();
    return teks || "-";
  }

  // 3) Bulanan: rentang mengikuti tanggal masuk penghuni
  const rentMonth = BULAN_MAP[payment_month || ""];
  const bayar = parseYMD(input.payment_date);
  const masuk = parseYMD(input.entry_date);
  if (rentMonth !== undefined && bayar && masuk) {
    let rentYear = bayar.getFullYear();
    if (bayar.getMonth() === 11 && rentMonth === 0) rentYear += 1; // bayar Desember untuk Januari
    else if (bayar.getMonth() === 0 && rentMonth === 11) rentYear -= 1; // bayar Januari untuk Desember
    const tglMulai = new Date(rentYear, rentMonth, masuk.getDate());
    const tglSelesai = new Date(rentYear, rentMonth + 1, masuk.getDate());
    return `${fmtTgl(tglMulai)} - ${fmtTgl(tglSelesai)}`;
  }

  return payment_month || "-";
}
