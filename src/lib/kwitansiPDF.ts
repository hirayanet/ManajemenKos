import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate a payment receipt PDF for kosan
 * @param {Object} data - Payment data
 * @param {string} data.namaPenyewa
 * @param {string} data.periodeSewa
 * @param {string} data.nominal
 * @param {string} data.tanggal
 * @param {string} data.logoBase64 - Logo in base64 format
 */
export function generateKwitansiPDF({
  namaPenyewa,
  tanggalMasuk,
  nominal,
  tanggal,
  logoBase64,
  kamar,
  metodePembayaran,
  bulanSewa
}: {
  namaPenyewa: string;
  tanggalMasuk: string; // format yyyy-mm-dd
  nominal: string;
  tanggal: string; // tanggal pembayaran, format yyyy-mm-dd
  logoBase64: string;
  kamar: string;
  metodePembayaran: string;
  bulanSewa?: string;
}): { doc: jsPDF, periodeSewa: string } {
  const doc = new jsPDF();

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
  }

  // Header
  doc.setFontSize(18);
  doc.text('BUKTI PEMBAYARAN KOST', 105, 22, { align: 'center' });

  // Alamat dan kontak
  doc.setFontSize(10);
  doc.text('Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong', 105, 30, { align: 'center' });
  doc.text('Kontak Pengelola: 087722667913', 105, 36, { align: 'center' });



  // Hitung periode sewa otomatis
  // tanggalMasuk: tanggal masuk kos (yyyy-mm-dd)
  // tanggal: tanggal pembayaran (yyyy-mm-dd)
  let periodeSewa = '';
  try {
    // Parse tanggal secara manual untuk menghindari pergeseran timezone
    const parseYMD = (s: string) => {
      const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
      // Gunakan Date(year, monthIndex, day) agar dianggap waktu lokal tanpa offset UTC
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const masuk = parseYMD(tanggalMasuk);
    const bayar = parseYMD(tanggal);
    // Validasi tanggal
    if (
      !tanggalMasuk || !tanggal ||
      isNaN(masuk.getTime()) || isNaN(bayar.getTime())
    ) {
      throw new Error('Tanggal tidak valid');
    }

    const monthsMap: { [key: string]: number } = {
      "Januari": 0, "Februari": 1, "Maret": 2, "April": 3, "Mei": 4, "Juni": 5,
      "Juli": 6, "Agustus": 7, "September": 8, "Oktober": 9, "November": 10, "Desember": 11
    };

    const rentMonth = (bulanSewa && monthsMap[bulanSewa] !== undefined) 
      ? monthsMap[bulanSewa] 
      : bayar.getMonth();

    let rentYear = bayar.getFullYear();
    // Jika bayar di Desember tapi untuk Januari, tahun sewa maju 1 tahun
    if (bayar.getMonth() === 11 && rentMonth === 0) {
      rentYear += 1;
    }
    // Jika bayar di Januari tapi untuk Desember, tahun sewa mundur 1 tahun
    else if (bayar.getMonth() === 0 && rentMonth === 11) {
      rentYear -= 1;
    }

    // Periode sewa berdasarkan bulan sewa (rentMonth) dan tanggal masuk sebagai acuan tanggal
    const mulai = new Date(rentYear, rentMonth, masuk.getDate());
    const akhir = new Date(rentYear, rentMonth + 1, masuk.getDate());

    // Format tanggal: 5 Agustus 2025
    const formatTanggal = (tgl: Date) => tgl.getDate() + ' ' + tgl.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    periodeSewa = `${formatTanggal(mulai)} - ${formatTanggal(akhir)}`;
  } catch (e) {
    periodeSewa = '-';
  }

  // Data pembayaran
  autoTable(doc, {
    startY: 50,
    head: [['Nama Penyewa', 'Kamar', 'Periode Sewa', 'Nominal', 'Tanggal', 'Metode Pembayaran']],
    body: [[namaPenyewa, kamar, periodeSewa, nominal, tanggal, metodePembayaran]],
    theme: 'grid',
    headStyles: { fillColor: [0, 123, 255] },
    styles: { halign: 'center' },
  });

  // Stempel bulat di atas garis tanda tangan
  const stampX = 170; // kanan bawah, dekat tanda tangan
  const stampY = 100; // tepat di atas garis tanda tangan

  // Gambar lingkaran biru
  doc.setDrawColor(0, 102, 204); // Biru
  doc.setLineWidth(1.2);
  doc.circle(stampX + 15, stampY + 15, 15, 'S'); // x, y, radius, style

  // Tulisan 'LUNAS' warna biru
  doc.setFontSize(12);
  doc.setTextColor(0, 102, 204);
  doc.setFont('helvetica', 'bold');
  doc.text('LUNAS', stampX + 15, stampY + 13, { align: 'center' });

  // Tulisan 'Hiraya Kost' warna merah di bawahnya
  doc.setFontSize(10);
  doc.setTextColor(200, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Hiraya Kost', stampX + 15, stampY + 22, { align: 'center' });

  // Kembalikan warna ke hitam untuk konten lain
  doc.setTextColor(0, 0, 0);

  // Tanda tangan
  doc.text('Pengelola Kost', 160, 110);
  doc.text('_____________________', 150, 128);

  return { doc, periodeSewa };
}
