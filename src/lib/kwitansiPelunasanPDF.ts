import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate kwitansi PDF untuk Pelunasan kosan (setelah DP)
 * Format mengikuti kwitansi pembayaran reguler yang sudah ada
 */
export function generateKwitansiPelunasanPDF({
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
  bulanSewa: string;        // e.g. "Juni"
  tanggalMasuk: string;     // yyyy-mm-dd (= tanggal pelunasan = entry_date)
  metodePembayaran: string;
  logoBase64: string;
}): { doc: jsPDF; periodeSewa: string } {
  const doc = new jsPDF();

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
  }

  // Header
  doc.setFontSize(18);
  doc.text('BUKTI PEMBAYARAN HIRAYA KOST', 105, 22, { align: 'center' });

  // Alamat dan kontak
  doc.setFontSize(10);
  doc.text('Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong', 105, 30, { align: 'center' });
  doc.text('Kontak Pengelola: 087722667913', 105, 36, { align: 'center' });

  // Hitung periode sewa
  let periodeSewa = '';
  try {
    const parseYMD = (s: string) => {
      const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const monthsMap: { [key: string]: number } = {
      "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5,
      "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11
    };

    const masuk = parseYMD(tanggalMasuk);
    const bayar = parseYMD(tanggalPelunasan);

    const rentMonth = (bulanSewa && monthsMap[bulanSewa] !== undefined)
      ? monthsMap[bulanSewa]
      : bayar.getMonth();

    let rentYear = bayar.getFullYear();
    if (bayar.getMonth() === 11 && rentMonth === 0) rentYear += 1;
    else if (bayar.getMonth() === 0 && rentMonth === 11) rentYear -= 1;

    const mulai = new Date(rentYear, rentMonth, masuk.getDate());
    const akhir = new Date(rentYear, rentMonth + 1, masuk.getDate());
    const formatTanggal = (tgl: Date) =>
      tgl.getDate() + ' ' + tgl.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    periodeSewa = `${formatTanggal(mulai)} - ${formatTanggal(akhir)}`;
  } catch {
    periodeSewa = bulanSewa || '-';
  }

  // Tabel data pelunasan
  autoTable(doc, {
    startY: 50,
    head: [['Nama Penyewa', 'Kamar', 'Periode Sewa', 'DP', 'Pelunasan', 'Total', 'Tanggal', 'Metode']],
    body: [[
      namaPenyewa,
      kamar,
      periodeSewa,
      nominalDP,
      nominalPelunasan,
      totalHarga,
      tanggalPelunasan,
      metodePembayaran,
    ]],
    theme: 'grid',
    headStyles: { fillColor: [0, 123, 255] },
    styles: { halign: 'center', fontSize: 8 },
  });

  // Stempel bulat biru "LUNAS"
  const stampX = 170;
  const stampY = 100;

  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(1.2);
  doc.circle(stampX + 15, stampY + 15, 15, 'S');

  doc.setFontSize(12);
  doc.setTextColor(0, 102, 204);
  doc.setFont('helvetica', 'bold');
  doc.text('LUNAS', stampX + 15, stampY + 13, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(200, 0, 0);
  doc.text('Hiraya Kost', stampX + 15, stampY + 22, { align: 'center' });

  // Reset warna
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Tanda tangan
  doc.text('Pengelola Kost', 160, 110);
  doc.text('_____________________', 150, 128);

  return { doc, periodeSewa };
}
