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
  metodePembayaran
}: {
  namaPenyewa: string;
  tanggalMasuk: string; // format yyyy-mm-dd
  nominal: string;
  tanggal: string; // tanggal pembayaran, format yyyy-mm-dd
  logoBase64: string;
  kamar: string;
  metodePembayaran: string;
}) {
  const doc = new jsPDF();

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
  }

  // Header
  doc.setFontSize(18);
  doc.text('BUKTI PEMBAYARAN KOS', 105, 22, { align: 'center' });

  // Alamat dan kontak
  doc.setFontSize(10);
  doc.text('Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong', 105, 30, { align: 'center' });
  doc.text('Kontak Pengelola: 087722667913', 105, 36, { align: 'center' });



  // Hitung periode sewa otomatis
  // tanggalMasuk: tanggal masuk kos (yyyy-mm-dd)
  // tanggal: tanggal pembayaran (yyyy-mm-dd)
  let periodeSewa = '';
  try {
    const masuk = new Date(tanggalMasuk);
    const bayar = new Date(tanggal);
    // Validasi tanggal
    if (
      !tanggalMasuk || !tanggal ||
      isNaN(masuk.getTime()) || isNaN(bayar.getTime())
    ) {
      throw new Error('Tanggal tidak valid');
    }
    // Tanggal mulai = tanggal masuk, tapi di bulan pembayaran
    const mulai = new Date(bayar.getFullYear(), bayar.getMonth(), masuk.getDate());
    // Jika pembayaran dilakukan sebelum tanggal masuk di bulan berjalan, ambil bulan sebelumnya
    if (bayar.getDate() < masuk.getDate()) {
      mulai.setMonth(mulai.getMonth() - 1);
    }
    const akhir = new Date(mulai);
    akhir.setMonth(akhir.getMonth() + 1);
    // Format tanggal: 1 Februari 2025
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

  // Tanda tangan
  doc.text('Pengelola Kos', 160, 110);
  doc.text('_____________________', 150, 120);

  return doc;
}
