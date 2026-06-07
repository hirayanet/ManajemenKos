import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate kwitansi PDF untuk Down Payment (DP) kosan
 */
export function generateKwitansiDPPDF({
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
}): { doc: jsPDF } {
  const doc = new jsPDF();

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25);
  }

  // Header
  doc.setFontSize(18);
  doc.text('BUKTI DOWN PAYMENT (DP) HIRAYA KOST', 105, 22, { align: 'center' });

  // Alamat dan kontak
  doc.setFontSize(10);
  doc.text('Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong', 105, 30, { align: 'center' });
  doc.text('Kontak Pengelola: 087722667913', 105, 36, { align: 'center' });

  // Format tanggal ke dd MMMM yyyy (Indonesia)
  const formatTanggalID = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${d} ${months[(m || 1) - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const tanggalDPFormatted = formatTanggalID(tanggalDP);
  const deadlineFormatted = formatTanggalID(deadlinePelunasan);

  // Tabel data DP
  autoTable(doc, {
    startY: 50,
    head: [['Keterangan', 'Detail']],
    body: [
      ['Nama Calon Penyewa', namaCalon],
      ['Kamar', kamar],
      ['Nominal Down Payment', nominalDP],
      ['Sisa Pelunasan', sisaPelunasan],
      ['Total Harga Sewa', totalHarga],
      ['Tanggal DP', tanggalDPFormatted],
      ['Deadline Pelunasan', deadlineFormatted],
      ['Metode Pembayaran', metodePembayaran],
    ],
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12] }, // Oranye untuk DP
    styles: { halign: 'left' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 110 },
    },
  });

  // Catatan peringatan
  const tableEndY = (doc as any).lastAutoTable?.finalY || 130;
  doc.setFontSize(9);
  doc.setTextColor(180, 0, 0);
  doc.text(
    '* Mohon lakukan pelunasan sebelum tanggal ' + deadlineFormatted + '.',
    15,
    tableEndY + 10
  );
  doc.text(
    'DP akan hangus jika melewati batas waktu.',
    15,
    tableEndY + 15
  );
  doc.setTextColor(0, 0, 0);

  // Tanda tangan & Stempel bulat oranye "DP"
  const signX = 165;
  const signY = tableEndY + 25; // Posisi teks "Pengelola Kost"

  // Reset warna
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Tanda tangan
  doc.text('Pengelola Kost', signX, signY, { align: 'center' });
  doc.text('_____________________', signX, signY + 25, { align: 'center' });

  // Stempel menutupi sebagian tanda tangan
  const stampX = signX + 12; // Geser sedikit ke kanan agar tidak tepat di tengah
  const stampY = signY + 12;

  doc.setDrawColor(234, 88, 12); // Oranye
  doc.setLineWidth(1.2);
  doc.circle(stampX, stampY, 14, 'S');

  doc.setFontSize(14);
  doc.setTextColor(234, 88, 12);
  doc.setFont('helvetica', 'bold');
  doc.text('DP', stampX, stampY - 2, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 0, 0);
  doc.text('Hiraya Kost', stampX, stampY + 6, { align: 'center' });

  // Kembalikan ke default
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  return { doc };
}
