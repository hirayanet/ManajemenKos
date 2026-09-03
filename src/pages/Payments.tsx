import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MobileFullScreenDialog from "@/components/MobileFullScreenDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Edit, Trash2, Download, Receipt, ReceiptText, Home, CalendarDays, Wallet, Pencil } from "lucide-react";
import { id as localeId } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { WhatsappIcon } from '@/components/ui/WhatsappIcon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { uploadPDFtoSupabase } from '../lib/supabaseUpload';
import { jsPDFToBlob } from '../lib/pdfUtils';
import { formatPeriodeSewa } from '../lib/periodeSewa';
import { format } from "date-fns";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import jsPDF from "jspdf";
import logoImg from '../assets/hr_logo_base64'; // (Pastikan file ini ada dan berisi string base64 logo Anda)
import { generateKwitansiPDF } from '../lib/kwitansiPDF';
import { downloadKwitansiImage } from '../lib/kwitansiImage';

// Harga kamar tetap
const ROOM_PRICES: Record<number, number> = {
  1: 1275000, 2: 1275000, 3: 1275000, 4: 1275000, 5: 1275000, 6: 1275000,
  7: 1575000,
  8: 1375000, 10: 1375000, 11: 1375000, 12: 1375000, 13: 1375000, 15: 1375000,
  9: 1575000, 14: 1575000,
};

const getRoomPrice = (roomNumber: number): number => ROOM_PRICES[roomNumber] ?? 0;

// Format tanggal Date -> "YYYY-MM-DD" (lokal)
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Resident {
  id: string;
  full_name: string;
  rooms: { room_number: number };
  entry_date: string; // tanggal masuk penghuni
}

interface Payment {
  id: string;
  resident_id: string;
  payment_date: string;
  payment_month: string;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
  amount: number;
  payment_method: string;
  receipt_url?: string;
  created_at: string;
  residents: {
    full_name: string;
    rooms: { room_number: number };
    entry_date: string; // tanggal masuk penghuni
  };
}

export default function Payments() {
  // State utama
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{ url: string; text: string } | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [kwitansiSheetPayment, setKwitansiSheetPayment] = useState<Payment | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null); // konfirmasi hapus (tabel desktop)

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const [formData, setFormData] = useState<{
    resident_id: string;
    amount: string;
    payment_method: string;
    payment_date: string;
    payment_month: string;
  }>({
    resident_id: "",
    amount: "",
    payment_method: "Transfer Bank",
    payment_date: new Date().toISOString().split("T")[0],
    payment_month: months[new Date().getMonth()],
  });
  const [paymentType, setPaymentType] = useState<"bulanan" | "harian">("bulanan");
  const [dailyRate, setDailyRate] = useState("");
  const [numDays, setNumDays] = useState("");
  const [dailyStart, setDailyStart] = useState(""); // Tanggal mulai sewa (khusus harian)

  const paymentMethods = [
    "Tunai",
    "Transfer Bank",
    "E-Wallet",
    "Kartu Debit",
  ];

  const [filterMonth, setFilterMonth] = useState<string>(months[new Date().getMonth()]);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    fetchPayments(0);
  }, [filterMonth, filterYear]);

  const fetchPayments = async (targetPage: number) => {
    try {
      // Skeleton only for first page; otherwise use loadingMore state
      if (targetPage === 0) setLoadingPayments(true);
      if (targetPage > 0) setLoadingMore(true);

      let query = supabase
        .from("payments")
        .select(`
          *,
          residents (
            full_name,
            rooms (room_number),
            entry_date
          )
        `);

      // Filter berdasarkan bulan & tahun PERIODE sewa (akurat lintas bulan/tahun):
      // - Bulanan : payment_month = nama bulan & payment_date pada tahun terpilih (perilaku lama).
      // - Harian  : periode_mulai jatuh pada bulan/tahun terpilih.
      // - Fallback: data harian lama yang belum dimigrasi (periode_mulai kosong) tetap
      //   dicocokkan lewat teks "Harian: ..." + payment_date pada tahun terpilih.
      const yearStart = `${filterYear}-01-01`;
      const yearEnd = `${filterYear}-12-31`;
      const monthIdx = months.indexOf(filterMonth);
      if (filterMonth !== "Semua" && monthIdx >= 0) {
        const monthNum = String(monthIdx + 1).padStart(2, "0");
        const monthStart = `${filterYear}-${monthNum}-01`;
        const lastDay = new Date(parseInt(filterYear), monthIdx + 1, 0).getDate();
        const monthEnd = `${filterYear}-${monthNum}-${String(lastDay).padStart(2, "0")}`;
        query = query.or(
          `and(payment_month.eq.${filterMonth},payment_date.gte.${yearStart},payment_date.lte.${yearEnd}),` +
          `and(periode_mulai.gte.${monthStart},periode_mulai.lte.${monthEnd}),` +
          `and(periode_mulai.is.null,payment_month.like.Harian:*${filterMonth}*,payment_date.gte.${yearStart},payment_date.lte.${yearEnd})`
        );
      } else {
        query = query.or(
          `and(payment_date.gte.${yearStart},payment_date.lte.${yearEnd}),` +
          `and(periode_mulai.gte.${yearStart},periode_mulai.lte.${yearEnd})`
        );
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(targetPage * pageSize, targetPage * pageSize + pageSize - 1);

      if (error) throw error;
      const rows = data || [];
      if (targetPage === 0) {
        setPayments(rows);
      } else {
        setPayments((prev) => [...prev, ...rows]);
      }
      setHasMore(rows.length === pageSize);
      setPage(targetPage);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data pembayaran",
        variant: "destructive",
      });
    }
    finally {
      if (targetPage === 0) setLoadingPayments(false);
      if (targetPage > 0) setLoadingMore(false);
    }
  };

  // Hanya tampilkan penghuni yang belum membayar bulan berjalan di menu tambah pembayaran
  const fetchResidents = async () => {
    try {
      // Ambil semua pembayaran bulan berjalan
      const today = new Date();
      const currentMonth = today.getMonth(); // 0-based
      const currentYear = today.getFullYear();
      // Nama bulan dalam Bahasa Indonesia sesuai array months
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const currentMonthName = months[currentMonth];

      // Ambil semua pembayaran bulan berjalan beserta nomor kamar dari relasi resident -> rooms
      const { data: paymentsThisMonth, error: paymentsError } = await supabase
        .from("payments")
        .select(`
          resident_id,
          payment_month,
          payment_date,
          residents (
            rooms ( room_number )
          )
        `)
        .eq("payment_month", currentMonthName)
        .filter('payment_date', 'gte', `${currentYear}-01-01`); // Pastikan tahun sama

      if (paymentsError) throw paymentsError;
      // Kumpulkan nomor kamar yang sudah memiliki pembayaran bulan berjalan
      const paidRoomNumbers = new Set(
        (paymentsThisMonth || [])
          .map((p: any) => p?.residents?.rooms?.room_number)
          .filter((n: any) => n !== null && n !== undefined)
      );

      // Ambil penghuni aktif yang BELUM membayar bulan ini
      const { data, error } = await supabase
        .from("residents")
        .select(`
          id,
          full_name,
          rooms (room_number),
          entry_date
        `)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      // Filter agar seluruh penghuni yang kamarnya sudah bayar bulan ini tidak tampil
      const filtered = (data || [])
        .filter((r: any) => !paidRoomNumbers.has(r?.rooms?.room_number))
        .sort((a: any, b: any) => (a.rooms?.room_number || 0) - (b.rooms?.room_number || 0));
      setResidents(filtered);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data penghuni",
        variant: "destructive",
      });
    }
  };

  // Generate and download image kwitansi
  const generateReceiptImage = async (payment: Payment) => {
    try {
      const periodeSewa = formatPeriodeSewa({
        payment_month: payment.payment_month,
        payment_date: payment.payment_date,
        entry_date: payment.residents.entry_date,
        periode_mulai: payment.periode_mulai ?? null,
        periode_selesai: payment.periode_selesai ?? null,
      });
      await downloadKwitansiImage(
        {
          namaPenyewa: payment.residents.full_name,
          kamar: payment.residents.rooms?.room_number?.toString() || '-',
          periodeSewa,
          nominal: `Rp ${payment.amount.toLocaleString('id-ID')}`,
          tanggalBayar: format(new Date(payment.payment_date), 'dd MMMM yyyy'),
          metodePembayaran: payment.payment_method,
        },
        `kwitansi-${payment.residents.full_name.replace(/\s+/g, '_')}-${payment.payment_date}.png`
      );
      toast({ title: 'Berhasil', description: 'Kwitansi gambar berhasil diunduh' });
    } catch (err: any) {
      toast({ title: 'Gagal', description: err?.message || 'Gagal generate kwitansi gambar', variant: 'destructive' });
    }
  };

  // Generate and download PDF
  const generateReceiptPDF = async (payment: Payment) => {
    const periodeSewa = formatPeriodeSewa({
      payment_month: payment.payment_month,
      payment_date: payment.payment_date,
      entry_date: payment.residents.entry_date,
      periode_mulai: payment.periode_mulai ?? null,
      periode_selesai: payment.periode_selesai ?? null,
    });
    const { doc } = await generateKwitansiPDF({
      namaPenyewa: payment.residents.full_name,
      tanggalMasuk: payment.residents.entry_date, // gunakan entry_date sebagai tanggal masuk penghuni
      nominal: `Rp ${payment.amount.toLocaleString('id-ID')}`,
      tanggal: payment.payment_date,
      logoBase64: logoImg,
      kamar: payment.residents.rooms?.room_number ? payment.residents.rooms.room_number.toString() : '',
      metodePembayaran: payment.payment_method,
      bulanSewa: payment.payment_month,
      periodeSewa,
    });
    doc.save(`kwitansi-${payment.residents.full_name}-${payment.payment_date}.pdf`);
  };


  // Fungsi share kwitansi — generates viewer page link
  const handleShareKwitansi = async (payment: Payment) => {
    setUploadingId(payment.id);
    setShareUrl(null);
    try {
      if (!payment.residents.full_name || !payment.residents.entry_date || !payment.amount || !payment.payment_date) {
        throw new Error('Data pembayaran/resident tidak lengkap!');
      }

      // Build the viewer page URL
      const baseUrl = window.location.origin;
      const viewerUrl = `${baseUrl}/kwitansi/${payment.id}`;

      // Periode sewa: harian = tanggal mulai s/d akhir sewa (dari kolom periode),
      // bulanan = rentang tanggal mengikuti tanggal masuk penghuni di bulan yang dibayar.
      const periodeSewa = formatPeriodeSewa({
        payment_month: payment.payment_month,
        payment_date: payment.payment_date,
        entry_date: payment.residents.entry_date,
        periode_mulai: payment.periode_mulai ?? null,
        periode_selesai: payment.periode_selesai ?? null,
      });

      setShareUrl(viewerUrl);
      await supabase.from('payments').update({ receipt_url: viewerUrl }).eq('id', payment.id);

      const kamarTxt =
        payment.residents.rooms?.room_number != null
          ? `Kamar ${payment.residents.rooms.room_number}`
          : "-";
      const shareText = `Berikut kwitansi pembayaran sewa kos untuk periode: *${periodeSewa}*\n\n🏠 Nama: ${payment.residents.full_name}\n🚪 Kamar: ${kamarTxt}\n💰 Nominal: Rp ${payment.amount.toLocaleString('id-ID')}\n💳 Metode Pembayaran: ${payment.payment_method}\n📆 Tanggal Bayar: ${format(new Date(payment.payment_date), 'dd MMMM yyyy', { locale: undefined })}\n\nSilakan klik link berikut untuk melihat kwitansi:\n${viewerUrl}\n\nTerima kasih telah melakukan pembayaran tepat waktu.\nSalam,\nPengelola Kos`;
      setShareModal({ url: viewerUrl, text: shareText });
    } catch (err: any) {
      console.error('Error handleShareKwitansi:', err);
      toast({ title: 'Error', description: err?.message || 'Gagal membuat link kwitansi', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Pembayaran harian: periode sewa disimpan sebagai kolom tanggal terstruktur
      // (periode_mulai & periode_selesai) + teks "Harian: ..." untuk tampilan kwitansi.
      // Tanggal mulai sewa (dailyStart) bisa berbeda dari tanggal bayar (payment_date).
      let effectivePaymentMonth = formData.payment_month;
      let periodeMulai: string | null = null;
      let periodeSelesai: string | null = null;
      if (paymentType === "harian" && numDays) {
        const startDateText = dailyStart || formData.payment_date;
        const startParts = startDateText.split('-').map(Number);
        const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        const endDate = new Date(startParts[0], startParts[1] - 1, startParts[2] + parseInt(numDays) - 1);
        const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'long' })} ${d.getFullYear()}`;
        effectivePaymentMonth = `Harian: ${fmt(startDate)} - ${fmt(endDate)}`;
        periodeMulai = toISODate(startDate);
        periodeSelesai = toISODate(endDate);
      } else if (!months.includes(formData.payment_month)) {
        // Hindari menyimpan teks "Harian: ..." saat jenis diubah ke bulanan saat edit
        effectivePaymentMonth = months[new Date().getMonth()];
      }

      const paymentData = {
        resident_id: formData.resident_id,
        payment_date: formData.payment_date,
        payment_month: effectivePaymentMonth,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        periode_mulai: periodeMulai,
        periode_selesai: periodeSelesai,
      };

      if (selectedPayment) {
        const { error } = await supabase
          .from("payments")
          .update(paymentData)
          .eq("id", selectedPayment.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Data pembayaran berhasil diperbarui",
        });
      } else {
        const { error } = await supabase
          .from("payments")
          .insert(paymentData);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Pembayaran baru berhasil ditambahkan",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayments(0);
      // Refresh daftar penghuni agar kamar yang sudah membayar bulan ini tersembunyi
      fetchResidents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat menyimpan data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pembayaran berhasil dihapus",
      });
      fetchPayments(0);
      fetchResidents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus pembayaran",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      resident_id: "",
      amount: "",
      payment_method: "Transfer Bank",
      payment_date: new Date().toISOString().split("T")[0],
      payment_month: months[new Date().getMonth()],
    });
    setSelectedPayment(null);
    setPaymentType("bulanan");
    setDailyStart("");
    setDailyRate("");
    setNumDays("");
  };

  const openEditDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setFormData({
      resident_id: payment.resident_id,
      payment_date: payment.payment_date,
      payment_month: payment.payment_month,
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
    });
    // Detect daily payment
    const isDaily = payment.payment_month.startsWith("Harian");
    setPaymentType(isDaily ? "harian" : "bulanan");
    if (isDaily) {
      // Isi ulang tanggal mulai, jumlah hari & tarif dari kolom periode terstruktur
      const mulai = payment.periode_mulai;
      const selesai = payment.periode_selesai;
      if (mulai && selesai) {
        const startMs = new Date(mulai + "T00:00:00").getTime();
        const endMs = new Date(selesai + "T00:00:00").getTime();
        const days = Math.round((endMs - startMs) / 86400000) + 1;
        setDailyStart(mulai);
        setNumDays(days > 0 ? String(days) : "");
        setDailyRate(days > 0 && payment.amount ? String(Math.round(payment.amount / days)) : "");
      } else {
        // Data lama tanpa kolom periode: mulai dianggap tanggal bayar, hari diisi ulang
        setDailyStart(payment.payment_date);
        setNumDays("");
        setDailyRate("");
      }
    } else {
      setDailyStart("");
      setDailyRate("");
      setNumDays("");
    }
    setIsDialogOpen(true);
  };

  const openAddDialog = async () => {
    resetForm();
    // Lazy load daftar penghuni hanya saat dibutuhkan
    await fetchResidents();
    setIsDialogOpen(true);
  };

  const paymentsSorted = useMemo(() =>
    payments
      .slice()
      .sort((a, b) => (a.residents.rooms.room_number || 0) - (b.residents.rooms.room_number || 0))
  , [payments]);

  // Ringkasan periode harian untuk pratinjau di form
  const dailyPeriodText = (() => {
    if (paymentType !== "harian" || !dailyStart || !numDays) return "";
    const parts = dailyStart.split("-").map(Number);
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const end = new Date(parts[0], parts[1] - 1, parts[2] + parseInt(numDays) - 1);
    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleString("id-ID", { month: "long" })} ${d.getFullYear()}`;
    return `${fmt(start)} - ${fmt(end)}`;
  })();

  // Periode harian versi ringkas utk daftar:
  // "3 - 4 September 2026" / "30 September - 1 Oktober 2026" / lintas tahun tetap lengkap
  const fmtDailyPeriod = (payment: Payment) => {
    const mulai = payment.periode_mulai ? new Date(payment.periode_mulai + "T00:00:00") : null;
    const selesai = payment.periode_selesai ? new Date(payment.periode_selesai + "T00:00:00") : null;
    const namaBulan = (d: Date) => months[d.getMonth()];
    if (mulai && selesai && mulai.getTime() <= selesai.getTime()) {
      const sy = mulai.getFullYear();
      const sm = mulai.getMonth();
      if (selesai.getFullYear() === sy && selesai.getMonth() === sm) {
        return `${mulai.getDate()} - ${selesai.getDate()} ${namaBulan(mulai)} ${sy}`;
      }
      if (selesai.getFullYear() === sy) {
        return `${mulai.getDate()} ${namaBulan(mulai)} - ${selesai.getDate()} ${namaBulan(selesai)} ${sy}`;
      }
      return `${mulai.getDate()} ${namaBulan(mulai)} ${sy} - ${selesai.getDate()} ${namaBulan(selesai)} ${selesai.getFullYear()}`;
    }
    // Data lama tanpa kolom periode: buang awalan "Harian: "
    return (payment.payment_month || "").replace(/^Harian:\s*/i, "") || "-";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Pembayaran</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Menampilkan data pembayaran berdasarkan bulan sewa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-45">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua Bulan</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Tahun" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { openAddDialog(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Tambah Pembayaran
          </Button>
          <MobileFullScreenDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title={selectedPayment ? "Edit Pembayaran" : "Tambah Pembayaran Baru"}
            description="Silakan lengkapi data pembayaran kos. Semua kolom wajib diisi."
            footer={
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>Batal</Button>
                <Button type="button" className="flex-1" disabled={isLoading} onClick={() => {
                  const forms = document.querySelectorAll('form');
                  forms.forEach(f => f.requestSubmit());
                }}>
                  {isLoading ? "Menyimpan..." : selectedPayment ? "Perbarui" : "Simpan"}
                </Button>
              </div>
            }
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Type Toggle */}
              <div className="space-y-2">
                <Label>Jenis Pembayaran</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentType === "bulanan" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => { setPaymentType("bulanan"); setDailyStart(""); setDailyRate(""); setNumDays(""); }}
                  >
                    Bulanan
                  </Button>
                  <Button
                    type="button"
                    variant={paymentType === "harian" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => { setPaymentType("harian"); setFormData({ ...formData, amount: "" }); if (!dailyStart) setDailyStart(formData.payment_date); }}
                  >
                    Harian
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resident_id">Penghuni</Label>
                {selectedPayment ? (
                  <Input
                    id="resident_name"
                    value={
                      selectedPayment.residents
                        ? `${selectedPayment.residents.full_name} - Kamar ${selectedPayment.residents.rooms?.room_number || "-"}`
                        : "Tidak Diketahui"
                    }
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                ) : (
                  <Select 
                    value={formData.resident_id} 
                    onValueChange={(value) => {
                      const selectedResident = residents.find(r => r.id === value);
                      const autoAmount = selectedResident
                        ? getRoomPrice(selectedResident.rooms.room_number).toString()
                        : "";
                      setFormData({ ...formData, resident_id: value, amount: autoAmount });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih penghuni" />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.map((resident) => (
                        <SelectItem key={resident.id} value={resident.id}>
                          {resident.full_name} - Kamar {resident.rooms.room_number}
                          {getRoomPrice(resident.rooms.room_number) > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              (Rp {getRoomPrice(resident.rooms.room_number).toLocaleString("id-ID")})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Daily fields — show when paymentType === harian */}
              {paymentType === "harian" && (
                <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily_rate">Tarif/Hari (Rp)</Label>
                    <Input
                      id="daily_rate"
                      type="number"
                      value={dailyRate}
                      onChange={(e) => {
                        const rate = e.target.value;
                        setDailyRate(rate);
                        const total = rate && numDays ? parseInt(rate) * parseInt(numDays) : 0;
                        setFormData({ ...formData, amount: total > 0 ? total.toString() : "" });
                      }}
                      placeholder="Contoh: 50000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="num_days">Jumlah Hari</Label>
                    <Input
                      id="num_days"
                      type="number"
                      value={numDays}
                      onChange={(e) => {
                        const days = e.target.value;
                        setNumDays(days);
                        const total = dailyRate && days ? parseInt(dailyRate) * parseInt(days) : 0;
                        setFormData({ ...formData, amount: total > 0 ? total.toString() : "" });
                      }}
                      placeholder="Contoh: 3"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily_start">Tanggal Mulai Sewa</Label>
                  <Input
                    id="daily_start"
                    type="date"
                    value={dailyStart}
                    onChange={(e) => setDailyStart(e.target.value)}
                    required
                  />
                </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Tanggal Bayar</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
                {paymentType === "harian" ? (
                  <div className="space-y-2">
                    <Label>Periode Sewa</Label>
                    <div className="min-h-[38px] flex items-center px-3 text-sm rounded-md border bg-muted text-muted-foreground">
                      {dailyPeriodText || "Isi tanggal mulai & jumlah hari"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="payment_month">Bulan Sewa</Label>
                    <Select
                      value={formData.payment_month}
                      onValueChange={(value) => setFormData({ ...formData, payment_month: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Jumlah
                    {!selectedPayment && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {paymentType === "harian" ? "(otomatis)" : "(otomatis dari kamar)"}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Metode Pembayaran</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih metode" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </form>
          </MobileFullScreenDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile list (cards) */}
          {loadingPayments && (
            <div className="block md:hidden space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="rounded-lg border p-4 bg-card text-card-foreground animate-pulse">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-24 mt-2" />
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-muted rounded w-24 ml-auto" />
                      <div className="h-3 bg-muted rounded w-16 mt-2 ml-auto" />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="h-3 bg-muted rounded w-20" />
                    <div className="h-3 bg-muted rounded w-20 ml-auto" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-8 bg-muted rounded w-full" />
                    <div className="h-8 bg-muted rounded w-10" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={`block md:hidden space-y-3 ${loadingPayments ? 'hidden' : ''}`}>
            {payments
              .slice()
              .sort((a, b) => (a.residents.rooms.room_number || 0) - (b.residents.rooms.room_number || 0))
              .map((payment) => {
                const roomNum = payment.residents?.rooms?.room_number;
                const isDaily = (payment.payment_month || "").startsWith("Harian");
                return (
                <div key={payment.id} className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <InitialsAvatar name={payment.residents?.full_name || "-"} seed={roomNum} className="h-10 w-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{payment.residents?.full_name || '-'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" /> Kamar {roomNum || '-'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-700">Rp {payment.amount.toLocaleString('id-ID')}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(payment.payment_date + "T00:00:00"), "d MMM yyyy", { locale: localeId })}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                    {isDaily ? (
                      <span className="inline-flex text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2.5 py-1">
                        {fmtDailyPeriod(payment)}
                      </span>
                    ) : (
                      <span className="inline-flex text-[11px] font-semibold bg-sky-100 text-sky-700 border border-sky-200 rounded-full px-2.5 py-1">
                        {payment.payment_month}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" /> {payment.payment_method}
                    </span>
                  </div>
                  <div className="border-t bg-muted/40 p-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-center"
                      title="Aksi Kwitansi"
                      onClick={() => setKwitansiSheetPayment(payment)}
                    >
                      <ReceiptText className="h-4 w-4 mr-1" /> Kwitansi
                    </Button>
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditDialog(payment)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Pembayaran</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus pembayaran ini? 
                            Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(payment.id)}>
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                );
              })}
          </div>
          {!loadingPayments && hasMore && (
            <div className="block md:hidden mt-4">
              <Button onClick={() => fetchPayments(page + 1)} disabled={loadingMore} className="w-full">
                {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
              </Button>
            </div>
          )}

          {/* Desktop/tablet table */}
          <div className="hidden md:block overflow-x-auto">
          {loadingPayments ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[240px]">Penghuni</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments
                .slice()
                .sort((a, b) => (a.residents.rooms.room_number || 0) - (b.residents.rooms.room_number || 0))
                .map((payment) => {
                  const roomNum = payment.residents?.rooms?.room_number;
                  const isDaily = (payment.payment_month || "").startsWith("Harian");
                  return (
                  <TableRow key={payment.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <InitialsAvatar name={payment.residents?.full_name || "-"} seed={roomNum} className="h-9 w-9 text-xs" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{payment.residents?.full_name || "-"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Home className="h-3 w-3" /> Kamar {roomNum || "-"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isDaily ? (
                        <span className="inline-flex text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                          {fmtDailyPeriod(payment)}
                        </span>
                      ) : (
                        <span className="inline-flex text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200 rounded-full px-2.5 py-1">
                          {payment.payment_month}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(payment.payment_date + "T00:00:00"), "d MMM yyyy", { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">Rp {payment.amount.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-sm">{payment.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full border-primary/20 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-white"
                              title="Aksi: kwitansi, edit, hapus"
                              aria-label="Aksi pembayaran"
                            >
                              <ReceiptText className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => generateReceiptImage(payment)}>
                              <Download className="h-4 w-4 mr-2" /> Unduh Kwitansi (Gambar)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateReceiptPDF(payment)}>
                              <Receipt className="h-4 w-4 mr-2" /> Unduh Kwitansi (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleShareKwitansi(payment)}
                              disabled={uploadingId === payment.id}
                            >
                              <span className="mr-2">🔗</span>
                              {uploadingId === payment.id ? (
                                <span className="flex items-center"><span className="animate-spin mr-2 h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></span> Uploading...</span>
                              ) : (
                                <>Bagikan Link Kwitansi</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(payment)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit Pembayaran
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletePayment(payment)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Hapus Pembayaran
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          )}
          </div>
          {!loadingPayments && hasMore && (
            <div className="hidden md:flex justify-center mt-4">
              <Button onClick={() => fetchPayments(page + 1)} disabled={loadingMore} variant="outline">
                {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Konfirmasi hapus (dipicu dari menu aksi tabel desktop) */}
      <AlertDialog open={!!deletePayment} onOpenChange={(o) => { if (!o) setDeletePayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pembayaran</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pembayaran{deletePayment?.residents?.full_name ? ` dari ${deletePayment.residents.full_name}` : " ini"}?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletePayment) handleDelete(deletePayment.id); setDeletePayment(null); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Mobile Kwitansi Action Sheet */}
      <Sheet open={!!kwitansiSheetPayment} onOpenChange={(o) => { if (!o) setKwitansiSheetPayment(null); }}>
        <SheetContent side="bottom" className="p-4">
          {kwitansiSheetPayment && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Aksi Kwitansi untuk <span className="font-medium">{kwitansiSheetPayment.residents?.full_name || '-'}</span>
              </div>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  generateReceiptImage(kwitansiSheetPayment);
                  setKwitansiSheetPayment(null);
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Unduh Kwitansi (Gambar)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  generateReceiptPDF(kwitansiSheetPayment);
                  setKwitansiSheetPayment(null);
                }}
              >
                <Receipt className="h-4 w-4 mr-2" /> Unduh Kwitansi (PDF)
              </Button>
              <Button
                className="w-full justify-center"
                disabled={uploadingId === kwitansiSheetPayment.id}
                onClick={() => handleShareKwitansi(kwitansiSheetPayment)}
              >
                {uploadingId === kwitansiSheetPayment.id ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></span>
                    Uploading...
                  </span>
                ) : (
                  <>Share Link Kwitansi</>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Modal Pilihan Media Share */}
      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full">
            <div className="font-bold mb-2">Bagikan Kwitansi</div>
            <div className="space-y-2">
              <a className="block w-full text-center bg-green-500 text-white rounded p-2" href={`https://wa.me/?text=${encodeURIComponent(shareModal.text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="block w-full text-center bg-blue-400 text-white rounded p-2" href={`https://t.me/share/url?url=${encodeURIComponent(shareModal.url)}&text=${encodeURIComponent(shareModal.text)}`} target="_blank" rel="noopener noreferrer">Telegram</a>
              <a className="block w-full text-center bg-gray-700 text-white rounded p-2" href={`mailto:?subject=Kwitansi Pembayaran&body=${encodeURIComponent(shareModal.text)}`}>Email</a>
              <button className="block w-full text-center bg-gray-200 rounded p-2 text-gray-700" onClick={() => {navigator.clipboard.writeText(shareModal.url); toast({title: 'Link disalin', description: 'Link kwitansi berhasil disalin ke clipboard'});}}>Copy Link</button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  className="block w-full text-center bg-blue-600 text-white rounded p-2 mb-2"
                  onClick={() => {
                    navigator.share({
                      title: 'Kwitansi Pembayaran',
                      text: shareModal.text
                    });
                  }}
                >
                  Share via Native Share
                </button>
              )}
              <button className="mt-4 w-full text-center bg-red-500 text-white rounded p-2" onClick={() => setShareModal(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}