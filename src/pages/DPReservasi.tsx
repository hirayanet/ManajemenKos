import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  PlusCircle, Trash2, Receipt, CheckCircle, XCircle, Clock,
  MoreHorizontal, Download, Share2, Ban,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { generateKwitansiDPPDF } from "@/lib/kwitansiDPpdf";
import { generateKwitansiPelunasanPDF } from "@/lib/kwitansiPelunasanPDF";
import { jsPDFToBlob } from "@/lib/pdfUtils";
import { uploadPDFtoSupabase } from "@/lib/supabaseUpload";
import logoImg from "@/assets/hr_logo_base64";

interface Room {
  id: number;
  room_number: number;
  is_occupied: boolean;
}

interface DPReservasi {
  id: string;
  nama_calon: string;
  phone_number: string | null;
  room_id: number;
  harga_per_bulan: number;
  nominal_dp: number;
  tanggal_dp: string;
  deadline_pelunasan: string;
  nominal_pelunasan: number;
  tanggal_pelunasan: string | null;
  payment_method_dp: string;
  payment_method_pelunasan: string | null;
  status: "Menunggu" | "Lunas" | "Hangus";
  resident_id: string | null;
  receipt_url_dp: string | null;
  receipt_url_pelunasan: string | null;
  catatan: string | null;
  created_at: string;
  rooms: { room_number: number };
}

const paymentMethods = ["Tunai", "Transfer Bank", "E-Wallet", "Kartu Debit"];

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Harga kamar tetap
const ROOM_PRICES: Record<number, number> = {
  1: 1275000, 2: 1275000, 3: 1275000, 4: 1275000, 5: 1275000, 6: 1275000,
  7: 1575000,
  8: 1375000, 10: 1375000, 11: 1375000, 12: 1375000, 13: 1375000, 15: 1375000,
  9: 1575000, 14: 1575000,
};

const getRoomPrice = (roomNumber: number): number => ROOM_PRICES[roomNumber] ?? 0;

const formatRupiah = (amount: number) =>
  `Rp ${amount.toLocaleString("id-ID")}`;

const formatTanggalID = (dateStr: string) => {
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale });
  } catch {
    return dateStr;
  }
};

const getStatusBadge = (status: DPReservasi["status"], deadline: string) => {
  // Auto-detect hangus di frontend untuk tampilan
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline + "T00:00:00");
  if (status === "Menunggu" && today > deadlineDate) {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />DP Hangus</Badge>;
  }
  if (status === "Hangus") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Hangus</Badge>;
  if (status === "Lunas") return <Badge className="bg-green-600 hover:bg-green-700 gap-1"><CheckCircle className="h-3 w-3" />Lunas</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Menunggu</Badge>;
};

const isHangus = (status: DPReservasi["status"], deadline: string) => {
  if (status === "Hangus") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return status === "Menunggu" && today > new Date(deadline + "T00:00:00");
};

export default function DPReservasi() {
  const [reservasiList, setReservasiList] = useState<DPReservasi[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPelunasanDialogOpen, setIsPelunasanDialogOpen] = useState(false);
  const [selectedReservasi, setSelectedReservasi] = useState<DPReservasi | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{ url: string; text: string } | null>(null);
  const [mobileSheetReservasi, setMobileSheetReservasi] = useState<DPReservasi | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    nama_calon: "",
    phone_number: "",
    room_id: "",
    harga_per_bulan: "",
    nominal_dp: "",
    tanggal_dp: new Date().toISOString().split("T")[0],
    deadline_pelunasan: "",
    payment_method_dp: "Tunai",
    catatan: "",
  });

  const [pelunasanForm, setPelunasanForm] = useState<{
    tanggal_pelunasan: string;
    payment_method_pelunasan: string;
    bulan_sewa: string;
    marital_status: string;
    ktp_file: File | null;
    marriage_file: File | null;
  }>({
    tanggal_pelunasan: new Date().toISOString().split("T")[0],
    payment_method_pelunasan: "Tunai",
    bulan_sewa: months[new Date().getMonth()],
    marital_status: "Lajang",
    ktp_file: null,
    marriage_file: null,
  });

  // Derived: sisa pelunasan dari form
  const sisaDariForm = useMemo(() => {
    const harga = parseFloat(formData.harga_per_bulan) || 0;
    const dp = parseFloat(formData.nominal_dp) || 0;
    return Math.max(0, harga - dp);
  }, [formData.harga_per_bulan, formData.nominal_dp]);

  useEffect(() => {
    fetchReservasi();
    fetchRooms();
  }, []);

  const fetchReservasi = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("dp_reservasi")
        .select(`*, rooms(room_number)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReservasiList((data || []) as DPReservasi[]);

      // Auto-update status Hangus di database jika deadline sudah lewat
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const toHangus = (data || []).filter(
        (r: any) => r.status === "Menunggu" && new Date(r.deadline_pelunasan + "T00:00:00") < today
      );
      if (toHangus.length > 0) {
        await Promise.all(
          toHangus.map((r: any) =>
            supabase.from("dp_reservasi").update({ status: "Hangus" }).eq("id", r.id)
          )
        );
        // Refresh data
        const { data: refreshed } = await supabase
          .from("dp_reservasi")
          .select(`*, rooms(room_number)`)
          .order("created_at", { ascending: false });
        setReservasiList((refreshed || []) as DPReservasi[]);
      }
    } catch {
      toast({ title: "Error", description: "Gagal memuat data reservasi DP", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from("rooms").select("*").order("room_number");
    setRooms(data || []);
  };

  // Upload KTP ke Supabase Storage
  const uploadKtpImage = async (file: File, residentId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `ktp/${residentId}.${fileExt}`;
    const { error } = await supabase.storage
      .from('ktp-images')
      .upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('ktp-images').getPublicUrl(filePath);
    return publicUrl;
  };

  // Upload dokumen nikah ke Supabase Storage
  const uploadMarriageDoc = async (file: File, residentId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `marriage/marriage_${residentId}.${fileExt}`;
    const { error } = await supabase.storage
      .from('ktp-images')
      .upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('ktp-images').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleSubmitDP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const harga = parseFloat(formData.harga_per_bulan);
      const dp = parseFloat(formData.nominal_dp);
      if (isNaN(harga) || harga <= 0) throw new Error("Harga per bulan tidak valid");
      if (isNaN(dp) || dp <= 0) throw new Error("Nominal DP tidak valid");
      if (dp >= harga) throw new Error("Nominal DP tidak boleh lebih besar atau sama dengan harga sewa");
      if (!formData.deadline_pelunasan) throw new Error("Deadline pelunasan wajib diisi");
      if (formData.deadline_pelunasan <= formData.tanggal_dp) throw new Error("Deadline pelunasan harus setelah tanggal DP");

      const { error } = await supabase.from("dp_reservasi").insert({
        nama_calon: formData.nama_calon,
        phone_number: formData.phone_number || null,
        room_id: parseInt(formData.room_id),
        harga_per_bulan: harga,
        nominal_dp: dp,
        tanggal_dp: formData.tanggal_dp,
        deadline_pelunasan: formData.deadline_pelunasan,
        payment_method_dp: formData.payment_method_dp,
        catatan: formData.catatan || null,
        status: "Menunggu",
      });
      if (error) throw error;

      toast({ title: "Berhasil", description: "Reservasi DP berhasil disimpan" });
      setIsDialogOpen(false);
      resetForm();
      fetchReservasi();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal menyimpan reservasi DP", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProsesPelunasan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservasi) return;
    setIsLoading(true);
    try {
      // 1. Buat penghuni baru di tabel residents
      const { data: newResident, error: resErr } = await supabase
        .from("residents")
        .insert({
          full_name: selectedReservasi.nama_calon,
          phone_number: selectedReservasi.phone_number || "",
          room_id: selectedReservasi.room_id,
          entry_date: pelunasanForm.tanggal_pelunasan,
          is_active: true,
          marital_status: pelunasanForm.marital_status,
          status_penghuni: "Aktif",
        })
        .select()
        .single();
      if (resErr) throw resErr;

      // 2. Upload KTP jika ada
      if (pelunasanForm.ktp_file) {
        try {
          const ktpUrl = await uploadKtpImage(pelunasanForm.ktp_file, newResident.id);
          await supabase.from("residents").update({ ktp_image_url: ktpUrl }).eq("id", newResident.id);
        } catch {
          toast({ title: "Peringatan", description: "Penghuni berhasil ditambahkan, tapi KTP gagal diupload. Silakan upload KTP dari menu Data Penghuni.", variant: "destructive" });
        }
      }

      // 3. Upload dokumen nikah jika menikah dan ada file
      if (pelunasanForm.marital_status === "Menikah" && pelunasanForm.marriage_file) {
        try {
          const marriageUrl = await uploadMarriageDoc(pelunasanForm.marriage_file, newResident.id);
          await supabase.from("residents").update({ marriage_document_url: marriageUrl }).eq("id", newResident.id);
        } catch {
          toast({ title: "Peringatan", description: "Dokumen nikah gagal diupload. Silakan upload dari menu Data Penghuni.", variant: "destructive" });
        }
      }

      // 4. Update status dp_reservasi jadi Lunas
      const { error: dpErr } = await supabase
        .from("dp_reservasi")
        .update({
          status: "Lunas",
          tanggal_pelunasan: pelunasanForm.tanggal_pelunasan,
          payment_method_pelunasan: pelunasanForm.payment_method_pelunasan,
          resident_id: newResident.id,
        })
        .eq("id", selectedReservasi.id);
      if (dpErr) throw dpErr;

      // 5. Tambahkan data pembayaran untuk bulan pertama ke tabel payments
      const { error: paymentErr } = await supabase
        .from("payments")
        .insert({
          resident_id: newResident.id,
          payment_date: pelunasanForm.tanggal_pelunasan,
          payment_month: pelunasanForm.bulan_sewa,
          amount: selectedReservasi.harga_per_bulan, // Pembayaran dihitung penuh 1 bulan sewa (DP + Sisa)
          payment_method: pelunasanForm.payment_method_pelunasan,
        });
      if (paymentErr) throw paymentErr;

      toast({ title: "Berhasil", description: `${selectedReservasi.nama_calon} telah lunas dan terdaftar sebagai penghuni aktif` });
      setIsPelunasanDialogOpen(false);
      setSelectedReservasi(null);
      fetchReservasi();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal proses pelunasan", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTandaiHangus = async (reservasi: DPReservasi) => {
    try {
      await supabase.from("dp_reservasi").update({ status: "Hangus" }).eq("id", reservasi.id);
      toast({ title: "Berhasil", description: "DP telah ditandai hangus" });
      fetchReservasi();
    } catch {
      toast({ title: "Error", description: "Gagal menandai DP hangus", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("dp_reservasi").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Reservasi berhasil dihapus" });
      fetchReservasi();
    } catch {
      toast({ title: "Error", description: "Gagal menghapus reservasi", variant: "destructive" });
    }
  };

  // === KWITANSI DP ===
  const handleKwitansiDP = async (reservasi: DPReservasi, mode: "download" | "share") => {
    const { doc } = generateKwitansiDPPDF({
      namaCalon: reservasi.nama_calon,
      kamar: reservasi.rooms?.room_number ? reservasi.rooms.room_number.toString() : "",
      nominalDP: formatRupiah(reservasi.nominal_dp),
      sisaPelunasan: formatRupiah(reservasi.nominal_pelunasan),
      totalHarga: formatRupiah(reservasi.harga_per_bulan),
      tanggalDP: reservasi.tanggal_dp,
      deadlinePelunasan: reservasi.deadline_pelunasan,
      metodePembayaran: reservasi.payment_method_dp,
      logoBase64: logoImg,
    });

    if (mode === "download") {
      doc.save(`dp-${reservasi.nama_calon.replace(/\s+/g, "_")}-${reservasi.tanggal_dp}.pdf`);
      return;
    }

    // Share
    setUploadingId(reservasi.id);
    try {
      const blob = await jsPDFToBlob(doc);
      const fileName = `dp-${reservasi.nama_calon.replace(/\s+/g, "_")}-${reservasi.tanggal_dp}-${Date.now()}.pdf`;
      const url = await uploadPDFtoSupabase(blob, fileName);
      if (!url) throw new Error("Gagal upload PDF");

      await supabase.from("dp_reservasi").update({ receipt_url_dp: url }).eq("id", reservasi.id);

      const deadlineFormatted = formatTanggalID(reservasi.deadline_pelunasan);
      const shareText =
        `Berikut bukti Down Payment (DP) kost untuk:\n\n` +
        `Nama: ${reservasi.nama_calon}\n` +
        `Kamar: ${reservasi.rooms?.room_number || "-"}\n` +
        `Nominal DP: ${formatRupiah(reservasi.nominal_dp)}\n` +
        `Sisa Pelunasan: ${formatRupiah(reservasi.nominal_pelunasan)}\n` +
        `Deadline Pelunasan: ${deadlineFormatted}\n\n` +
        `⚠️ Mohon lakukan pelunasan sebelum tanggal ${deadlineFormatted}.\n` +
        `DP akan hangus jika melewati batas waktu.\n\n` +
        `Silakan unduh bukti DP pada link berikut:\n${url}\n\n` +
        `Terima kasih,\nPengelola Hiraya Kost`;

      setShareModal({ url, text: shareText });
      setMobileSheetReservasi(null);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal membuat kwitansi DP", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  // === KWITANSI PELUNASAN ===
  const handleKwitansiPelunasan = async (reservasi: DPReservasi, mode: "download" | "share") => {
    if (!reservasi.tanggal_pelunasan) return;

    const { doc, periodeSewa } = generateKwitansiPelunasanPDF({
      namaPenyewa: reservasi.nama_calon,
      kamar: reservasi.rooms?.room_number ? reservasi.rooms.room_number.toString() : "",
      nominalDP: formatRupiah(reservasi.nominal_dp),
      nominalPelunasan: formatRupiah(reservasi.nominal_pelunasan),
      totalHarga: formatRupiah(reservasi.harga_per_bulan),
      tanggalPelunasan: reservasi.tanggal_pelunasan,
      bulanSewa: months[new Date(reservasi.tanggal_pelunasan + "T00:00:00").getMonth()],
      tanggalMasuk: reservasi.tanggal_pelunasan,
      metodePembayaran: reservasi.payment_method_pelunasan || "Tunai",
      logoBase64: logoImg,
    });

    if (mode === "download") {
      doc.save(`pelunasan-${reservasi.nama_calon.replace(/\s+/g, "_")}-${reservasi.tanggal_pelunasan}.pdf`);
      return;
    }

    // Share
    setUploadingId(reservasi.id + "_pelunasan");
    try {
      const blob = await jsPDFToBlob(doc);
      const fileName = `pelunasan-${reservasi.nama_calon.replace(/\s+/g, "_")}-${reservasi.tanggal_pelunasan}-${Date.now()}.pdf`;
      const url = await uploadPDFtoSupabase(blob, fileName);
      if (!url) throw new Error("Gagal upload PDF");

      await supabase.from("dp_reservasi").update({ receipt_url_pelunasan: url }).eq("id", reservasi.id);

      const shareText =
        `Berikut kwitansi pelunasan kost untuk periode: *${periodeSewa}*\n\n` +
        `Nama: ${reservasi.nama_calon}\n` +
        `Kamar: ${reservasi.rooms?.room_number || "-"}\n` +
        `DP Sebelumnya: ${formatRupiah(reservasi.nominal_dp)}\n` +
        `Pelunasan: ${formatRupiah(reservasi.nominal_pelunasan)}\n` +
        `Total: ${formatRupiah(reservasi.harga_per_bulan)}\n` +
        `Metode Pembayaran: ${reservasi.payment_method_pelunasan || "Tunai"}\n` +
        `Tanggal Bayar: ${formatTanggalID(reservasi.tanggal_pelunasan)}\n\n` +
        `Silakan unduh kwitansi pada link berikut: ${url}\n\n` +
        `Terima kasih telah melakukan pembayaran tepat waktu.\nSalam,\nPengelola Kos`;

      setShareModal({ url, text: shareText });
      setMobileSheetReservasi(null);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Gagal membuat kwitansi pelunasan", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      nama_calon: "",
      phone_number: "",
      room_id: "",
      harga_per_bulan: "",
      nominal_dp: "",
      tanggal_dp: new Date().toISOString().split("T")[0],
      deadline_pelunasan: "",
      payment_method_dp: "Tunai",
      catatan: "",
    });
  };

  const openPelunasanDialog = (reservasi: DPReservasi) => {
    setSelectedReservasi(reservasi);
    setPelunasanForm({
      tanggal_pelunasan: new Date().toISOString().split("T")[0],
      payment_method_pelunasan: "Tunai",
      bulan_sewa: months[new Date().getMonth()],
      marital_status: "Lajang",
      ktp_file: null,
      marriage_file: null,
    });
    setIsPelunasanDialogOpen(true);
  };

  // Statistik
  const stats = useMemo(() => {
    const menunggu = reservasiList.filter(r => r.status === "Menunggu" && !isHangus(r.status, r.deadline_pelunasan)).length;
    const lunas = reservasiList.filter(r => r.status === "Lunas").length;
    const hangus = reservasiList.filter(r => isHangus(r.status, r.deadline_pelunasan)).length;
    const totalDP = reservasiList.filter(r => r.status === "Lunas").reduce((s, r) => s + r.nominal_dp, 0);
    return { menunggu, lunas, hangus, totalDP };
  }, [reservasiList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            Reservasi Down Payment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola calon penghuni yang membayar DP sebelum masuk kost
          </p>
        </div>
        <div className="shrink-0">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Tambah Reservasi DP
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Reservasi Down Payment</DialogTitle>
                <DialogDescription>
                  Isi data calon penghuni yang membayar DP untuk memesan kamar.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitDP} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="nama_calon">Nama Calon Penghuni *</Label>
                    <Input
                      id="nama_calon"
                      value={formData.nama_calon}
                      onChange={e => setFormData(f => ({ ...f, nama_calon: e.target.value }))}
                      placeholder="Nama lengkap"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">No. Telepon</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={e => setFormData(f => ({ ...f, phone_number: e.target.value }))}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room_id">Kamar *</Label>
                    <Select
                      value={formData.room_id}
                      onValueChange={v => {
                        const selectedRoom = rooms.find(r => r.id.toString() === v);
                        const autoHarga = selectedRoom ? getRoomPrice(selectedRoom.room_number).toString() : "";
                        setFormData(f => ({ ...f, room_id: v, harga_per_bulan: autoHarga }));
                      }}
                    >
                      <SelectTrigger id="room_id">
                        <SelectValue placeholder="Pilih kamar" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms
                          .filter(room => !room.is_occupied)
                          .map(room => (
                            <SelectItem key={room.id} value={room.id.toString()}>
                              Kamar {room.room_number} — {formatRupiah(getRoomPrice(room.room_number))}/bln
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="harga_per_bulan">
                      Harga Sewa/Bulan (Rp)
                      {formData.harga_per_bulan && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(otomatis dari kamar)</span>
                      )}
                    </Label>
                    <Input
                      id="harga_per_bulan"
                      type="number"
                      value={formData.harga_per_bulan}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      placeholder="Pilih kamar terlebih dahulu"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nominal_dp">Nominal DP (Rp) *</Label>
                    <Input
                      id="nominal_dp"
                      type="number"
                      value={formData.nominal_dp}
                      onChange={e => setFormData(f => ({ ...f, nominal_dp: e.target.value }))}
                      placeholder="300000"
                      required
                    />
                  </div>
                  {/* Info sisa pelunasan */}
                  {sisaDariForm > 0 && (
                    <div className="sm:col-span-2 rounded-md bg-muted px-3 py-2 text-sm">
                      Sisa pelunasan: <span className="font-semibold text-primary">{formatRupiah(sisaDariForm)}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_dp">Tanggal DP *</Label>
                    <Input
                      id="tanggal_dp"
                      type="date"
                      value={formData.tanggal_dp}
                      onChange={e => setFormData(f => ({ ...f, tanggal_dp: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline_pelunasan">Deadline Pelunasan *</Label>
                    <Input
                      id="deadline_pelunasan"
                      type="date"
                      value={formData.deadline_pelunasan}
                      onChange={e => setFormData(f => ({ ...f, deadline_pelunasan: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="payment_method_dp">Metode Pembayaran DP *</Label>
                    <Select
                      value={formData.payment_method_dp}
                      onValueChange={v => setFormData(f => ({ ...f, payment_method_dp: v }))}
                    >
                      <SelectTrigger id="payment_method_dp">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="catatan">Catatan (opsional)</Label>
                    <Input
                      id="catatan"
                      value={formData.catatan}
                      onChange={e => setFormData(f => ({ ...f, catatan: e.target.value }))}
                      placeholder="Catatan tambahan..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Menyimpan..." : "Simpan Reservasi"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Menunggu Pelunasan", value: String(stats.menunggu), color: "text-yellow-600" },
          { label: "Lunas", value: String(stats.lunas), color: "text-green-600" },
          { label: "DP Hangus", value: String(stats.hangus), color: "text-red-600" },
          { label: "Total DP Diterima", value: formatRupiah(stats.totalDP), color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground leading-snug break-words">{s.label}</p>
              <p className={`text-lg sm:text-xl font-bold mt-1 truncate ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabel / List */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Reservasi DP</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : reservasiList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Belum ada data reservasi DP
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {reservasiList.map(reservasi => (
                  <div key={reservasi.id} className="rounded-lg border p-4 bg-card space-y-3">
                    {/* Baris 1: Nama + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{reservasi.nama_calon}</div>
                        <div className="text-sm text-muted-foreground">
                          Kamar {reservasi.rooms?.room_number}
                          {reservasi.phone_number && (
                            <span className="ml-2 text-xs">· {reservasi.phone_number}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(reservasi.status, reservasi.deadline_pelunasan)}
                      </div>
                    </div>
                    {/* Baris 2: Info Pembayaran */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Nominal DP</p>
                        <p className="font-semibold">{formatRupiah(reservasi.nominal_dp)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sisa Pelunasan</p>
                        <p className="font-semibold text-primary">{formatRupiah(reservasi.nominal_pelunasan)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tanggal DP</p>
                        <p className="font-medium">{format(new Date(reservasi.tanggal_dp + "T00:00:00"), "dd/MM/yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className="font-medium">{format(new Date(reservasi.deadline_pelunasan + "T00:00:00"), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                    {/* Baris 3: Tombol Aksi */}
                    <div className="flex gap-2 pt-1">
                      {reservasi.status === "Menunggu" && !isHangus(reservasi.status, reservasi.deadline_pelunasan) && (
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => openPelunasanDialog(reservasi)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Lunasi
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setMobileSheetReservasi(reservasi)}
                      >
                        <MoreHorizontal className="h-3 w-3 mr-1" /> Aksi Lain
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Nama Calon</TableHead>
                      <TableHead className="w-[90px]">Kamar</TableHead>
                      <TableHead className="w-[130px]">Nominal DP</TableHead>
                      <TableHead className="w-[130px]">Sisa Pelunasan</TableHead>
                      <TableHead className="w-[100px]">Tgl DP</TableHead>
                      <TableHead className="w-[100px]">Deadline</TableHead>
                      <TableHead className="w-[110px]">Status</TableHead>
                      <TableHead className="w-[80px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservasiList.map(reservasi => (
                      <TableRow key={reservasi.id}>
                        <TableCell>
                          <div className="font-medium">{reservasi.nama_calon}</div>
                          {reservasi.phone_number && (
                            <div className="text-xs text-muted-foreground mt-0.5">{reservasi.phone_number}</div>
                          )}
                        </TableCell>
                        <TableCell>Kamar {reservasi.rooms?.room_number}</TableCell>
                        <TableCell className="font-medium">{formatRupiah(reservasi.nominal_dp)}</TableCell>
                        <TableCell className="font-medium text-primary">{formatRupiah(reservasi.nominal_pelunasan)}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(reservasi.tanggal_dp + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(reservasi.deadline_pelunasan + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(reservasi.status, reservasi.deadline_pelunasan)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {/* Lunasi — hanya jika Menunggu dan belum hangus */}
                              {reservasi.status === "Menunggu" && !isHangus(reservasi.status, reservasi.deadline_pelunasan) && (
                                <>
                                  <DropdownMenuItem
                                    className="text-green-700 focus:text-green-700 focus:bg-green-50"
                                    onClick={() => openPelunasanDialog(reservasi)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" /> Proses Pelunasan
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {/* Kwitansi DP */}
                              <DropdownMenuItem onClick={() => handleKwitansiDP(reservasi, "download")}>
                                <Download className="h-4 w-4 mr-2" /> Download Kwitansi DP
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleKwitansiDP(reservasi, "share")}
                                disabled={uploadingId === reservasi.id}
                              >
                                <Share2 className="h-4 w-4 mr-2" />
                                {uploadingId === reservasi.id ? "Uploading..." : "Share Kwitansi DP"}
                              </DropdownMenuItem>
                              {/* Kwitansi Pelunasan — hanya jika sudah Lunas */}
                              {reservasi.status === "Lunas" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleKwitansiPelunasan(reservasi, "download")}>
                                    <Download className="h-4 w-4 mr-2" /> Download Kwitansi Lunas
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleKwitansiPelunasan(reservasi, "share")}
                                    disabled={uploadingId === reservasi.id + "_pelunasan"}
                                  >
                                    <Share2 className="h-4 w-4 mr-2" />
                                    {uploadingId === reservasi.id + "_pelunasan" ? "Uploading..." : "Share Kwitansi Lunas"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {/* Tandai Hangus — hanya jika Menunggu */}
                              {reservasi.status === "Menunggu" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                        onSelect={e => e.preventDefault()}
                                      >
                                        <Ban className="h-4 w-4 mr-2" /> Hanguskan DP
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Tandai DP Hangus?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          DP atas nama <strong>{reservasi.nama_calon}</strong> akan ditandai hangus. Tindakan ini tidak dapat dibatalkan.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600" onClick={() => handleTandaiHangus(reservasi)}>Hanguskan</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              {/* Hapus */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onSelect={e => e.preventDefault()}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Hapus Reservasi
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Reservasi?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Data reservasi DP atas nama <strong>{reservasi.nama_calon}</strong> akan dihapus permanen.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(reservasi.id)}>Hapus</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Proses Pelunasan */}
      <Dialog open={isPelunasanDialogOpen} onOpenChange={setIsPelunasanDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proses Pelunasan</DialogTitle>
            <DialogDescription>
              {selectedReservasi && (
                <span>
                  Konfirmasi pelunasan untuk <strong>{selectedReservasi.nama_calon}</strong> — Kamar {selectedReservasi.rooms?.room_number}.
                  {" "}Sisa bayar: <strong className="text-primary">{formatRupiah(selectedReservasi.nominal_pelunasan)}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedReservasi && (
            <form onSubmit={handleProsesPelunasan} className="space-y-4">
              {/* Ringkasan pembayaran */}
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>DP dibayar: <span className="font-semibold">{formatRupiah(selectedReservasi.nominal_dp)}</span></div>
                <div>Sisa pelunasan: <span className="font-semibold text-primary">{formatRupiah(selectedReservasi.nominal_pelunasan)}</span></div>
                <div>Total: <span className="font-semibold">{formatRupiah(selectedReservasi.harga_per_bulan)}</span></div>
              </div>

              {/* Tanggal & Metode Pembayaran */}
              <div className="space-y-2">
                <Label>Tanggal Pelunasan *</Label>
                <Input
                  type="date"
                  value={pelunasanForm.tanggal_pelunasan}
                  onChange={e => setPelunasanForm(f => ({ ...f, tanggal_pelunasan: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">Tanggal ini akan menjadi tanggal masuk penghuni</p>
              </div>
              <div className="space-y-2">
                <Label>Metode Pembayaran Pelunasan *</Label>
                <Select
                  value={pelunasanForm.payment_method_pelunasan}
                  onValueChange={v => setPelunasanForm(f => ({ ...f, payment_method_pelunasan: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Separator dokumen */}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-3">Data Penghuni</p>

                {/* Status Pernikahan */}
                <div className="space-y-2">
                  <Label>Status Pernikahan *</Label>
                  <Select
                    value={pelunasanForm.marital_status}
                    onValueChange={v => setPelunasanForm(f => ({ ...f, marital_status: v, marriage_file: v === "Lajang" ? null : f.marriage_file }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lajang">Lajang</SelectItem>
                      <SelectItem value="Menikah">Menikah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload KTP */}
                <div className="space-y-2 mt-3">
                  <Label className="flex items-center gap-2">
                    Upload KTP
                    <span className="text-xs text-muted-foreground font-normal">(opsional, bisa dilengkapi nanti)</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPelunasanForm(f => ({ ...f, ktp_file: e.target.files?.[0] || null }))}
                  />
                  {pelunasanForm.ktp_file && (
                    <p className="text-xs text-green-600">✓ File dipilih: {pelunasanForm.ktp_file.name}</p>
                  )}
                </div>

                {/* Upload Dokumen Nikah — hanya jika Menikah */}
                {pelunasanForm.marital_status === "Menikah" && (
                  <div className="space-y-2 mt-3">
                    <Label className="flex items-center gap-2">
                      Upload Dokumen Nikah
                      <span className="text-xs text-muted-foreground font-normal">(opsional)</span>
                    </Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setPelunasanForm(f => ({ ...f, marriage_file: e.target.files?.[0] || null }))}
                    />
                    {pelunasanForm.marriage_file && (
                      <p className="text-xs text-green-600">✓ File dipilih: {pelunasanForm.marriage_file.name}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPelunasanDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? "Memproses..." : "Konfirmasi Pelunasan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Share */}
      {shareModal && (
        <Dialog open={!!shareModal} onOpenChange={() => setShareModal(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Bagikan Kwitansi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3">
                <pre className="text-xs whitespace-pre-wrap break-words font-sans">{shareModal.text}</pre>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareModal.text)}`;
                    window.open(waUrl, "_blank");
                  }}
                >
                  <span className="mr-2">📱</span> Kirim via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(shareModal.text);
                    toast({ title: "Disalin!", description: "Teks telah disalin ke clipboard" });
                  }}
                >
                  📋 Salin Teks
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(shareModal.url, "_blank")}
                >
                  🔗 Buka Link PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile Action Sheet */}
      <Sheet open={!!mobileSheetReservasi} onOpenChange={o => { if (!o) setMobileSheetReservasi(null); }}>
        <SheetContent side="bottom" className="px-4 pb-6 pt-4 max-h-[85vh] overflow-y-auto">
          {mobileSheetReservasi && (
            <div className="space-y-4">
              <SheetHeader className="text-left space-y-1 pb-2 border-b">
                <SheetTitle className="text-base">{mobileSheetReservasi.nama_calon}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    Kamar {mobileSheetReservasi.rooms?.room_number}
                  </span>
                  {mobileSheetReservasi.phone_number && (
                    <span className="text-sm text-muted-foreground">· {mobileSheetReservasi.phone_number}</span>
                  )}
                  {getStatusBadge(mobileSheetReservasi.status, mobileSheetReservasi.deadline_pelunasan)}
                </div>
                <div className="flex gap-4 text-sm pt-1">
                  <div>
                    <span className="text-muted-foreground text-xs">DP: </span>
                    <span className="font-semibold">{formatRupiah(mobileSheetReservasi.nominal_dp)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Sisa: </span>
                    <span className="font-semibold text-primary">{formatRupiah(mobileSheetReservasi.nominal_pelunasan)}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-2">
                {/* Lunasi */}
                {mobileSheetReservasi.status === "Menunggu" && !isHangus(mobileSheetReservasi.status, mobileSheetReservasi.deadline_pelunasan) && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => { openPelunasanDialog(mobileSheetReservasi); setMobileSheetReservasi(null); }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Proses Pelunasan
                  </Button>
                )}

                {/* Kwitansi DP */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => { handleKwitansiDP(mobileSheetReservasi, "download"); setMobileSheetReservasi(null); }}
                >
                  <Download className="h-4 w-4 mr-2" /> Download Kwitansi DP
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={uploadingId === mobileSheetReservasi.id}
                  onClick={() => handleKwitansiDP(mobileSheetReservasi, "share")}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  {uploadingId === mobileSheetReservasi.id ? "Uploading..." : "Share Kwitansi DP"}
                </Button>

                {/* Kwitansi Pelunasan — hanya jika Lunas */}
                {mobileSheetReservasi.status === "Lunas" && (
                  <>
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Kwitansi Pelunasan</p>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => { handleKwitansiPelunasan(mobileSheetReservasi, "download"); setMobileSheetReservasi(null); }}
                      >
                        <Download className="h-4 w-4 mr-2" /> Download Kwitansi Lunas
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start mt-2"
                        disabled={uploadingId === mobileSheetReservasi.id + "_pelunasan"}
                        onClick={() => handleKwitansiPelunasan(mobileSheetReservasi, "share")}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        {uploadingId === mobileSheetReservasi.id + "_pelunasan" ? "Uploading..." : "Share Kwitansi Lunas"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
