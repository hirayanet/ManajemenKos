import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Edit, Trash2, Download, Receipt } from "lucide-react";
import { WhatsappIcon } from '@/components/ui/WhatsappIcon';
import { uploadPDFtoSupabase } from '../lib/supabaseUpload';
import { jsPDFToBlob } from '../lib/pdfUtils';
import { format } from "date-fns";
import jsPDF from "jspdf";
import logoImg from '../assets/hr_logo_base64'; // (Pastikan file ini ada dan berisi string base64 logo Anda)
import { generateKwitansiPDF } from '../lib/kwitansiPDF';

interface Resident {
  id: string;
  full_name: string;
  rooms: { room_number: number };
}

interface Payment {
  id: string;
  resident_id: string;
  payment_date: string;
  payment_month: string;
  amount: number;
  payment_method: string;
  receipt_url?: string;
  created_at: string;
  residents: {
    full_name: string;
    rooms: { room_number: number };
  };
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    resident_id: "",
    payment_date: "",
    payment_month: "",
    amount: "",
    payment_method: "",
  });

  const paymentMethods = [
    "Tunai",
    "Transfer Bank",
    "E-Wallet",
    "Kartu Debit",
  ];

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  useEffect(() => {
    fetchPayments();
    fetchResidents();
  }, []);

  const fetchPayments = async () => {
    try {
      setPayments([]);
      // Ambil tanggal hari ini
      const today = new Date();
      // Jika tanggal 1 jam 00:00-00:01, reset tampilan (tidak ada data)
      if (
        today.getDate() === 1 &&
        today.getHours() === 0 &&
        today.getMinutes() <= 1
      ) {
        return;
      }
      // Hitung awal dan akhir bulan berjalan
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
      // Akhir bulan = tanggal 1 bulan berikutnya - 1 hari
      const endDateObj = new Date(year, month, 0);
      const endDate = `${year}-${month.toString().padStart(2, "0")}-${endDateObj.getDate().toString().padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          residents (
            full_name,
            rooms (room_number)
          )
        `)
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data pembayaran",
        variant: "destructive",
      });
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

      // Ambil semua pembayaran bulan berjalan
      const { data: paymentsThisMonth, error: paymentsError } = await supabase
        .from("payments")
        .select("resident_id, payment_month, payment_date")
        .eq("payment_month", currentMonthName)
        .filter('payment_date', 'gte', `${currentYear}-01-01`); // Pastikan tahun sama

      if (paymentsError) throw paymentsError;
      const paidResidentIds = (paymentsThisMonth || []).map((p: any) => p.resident_id);

      // Ambil penghuni aktif yang BELUM membayar bulan ini
      const { data, error } = await supabase
        .from("residents")
        .select(`
          id,
          full_name,
          rooms (room_number)
        `)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      // Filter agar hanya yang belum ada di paidResidentIds dan urutkan berdasarkan room_number
      const filtered = (data || [])
        .filter((r: any) => !paidResidentIds.includes(r.id))
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

  // Generate and download PDF
  const generateReceiptPDF = (payment: Payment) => {
    const doc = generateKwitansiPDF({
      namaPenyewa: payment.residents.full_name,
      tanggalMasuk: payment.payment_date, // gunakan payment_date sebagai tanggal masuk (atau ganti dengan field yang benar jika ada)
      nominal: `Rp ${payment.amount.toLocaleString('id-ID')}`,
      tanggal: payment.payment_date,
      logoBase64: logoImg,
      kamar: payment.residents.rooms?.room_number ? `Kamar ${payment.residents.rooms.room_number}` : '',
      metodePembayaran: payment.payment_method,
    });
    doc.save(`kwitansi-${payment.residents.full_name}-${payment.payment_date}.pdf`);
  };

  // Generate, upload PDF, and get shareable link
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShareWhatsapp = async (payment: Payment) => {
    setUploadingId(payment.id);
    setShareUrl(null);
    try {
      const doc = generateKwitansiPDF({
        namaPenyewa: payment.residents.full_name,
        tanggalMasuk: payment.payment_date,
        nominal: `Rp ${payment.amount.toLocaleString('id-ID')}`,
        tanggal: payment.payment_date,
        logoBase64: logoImg,
        kamar: payment.residents.rooms?.room_number ? `Kamar ${payment.residents.rooms.room_number}` : '',
        metodePembayaran: payment.payment_method,
      });
      const blob = await jsPDFToBlob(doc);
      const fileName = `kwitansi-${payment.residents.full_name.replace(/\s+/g, "_")}-${payment.payment_date}.pdf`;
      const url = await uploadPDFtoSupabase(blob, fileName);
      if (url) {
        setShareUrl(url);
        // Optionally update payment record with receipt_url
        await supabase.from('payments').update({ receipt_url: url }).eq('id', payment.id);
        // Open WhatsApp share
        // Ambil bulan dan tahun dari payment_date
        const dateObj = new Date(payment.payment_date);
        const bulan = dateObj.toLocaleString('id-ID', { month: 'long' });
        const tahun = dateObj.getFullYear();
        const text = encodeURIComponent(`Berikut kwitansi pembayaran kos bulan ${bulan} ${tahun}: ${url}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      } else {
        toast({ title: 'Gagal upload PDF', description: 'Terjadi masalah saat upload kwitansi', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Gagal membuat atau upload kwitansi', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const paymentData = {
        resident_id: formData.resident_id,
        payment_date: formData.payment_date,
        payment_month: formData.payment_month,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
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
      fetchPayments();
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
      fetchPayments();
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
      payment_date: "",
      payment_month: "",
      amount: "",
      payment_method: "",
    });
    setSelectedPayment(null);
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
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Data Pembayaran</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              Tambah Pembayaran
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {selectedPayment ? "Edit Pembayaran" : "Tambah Pembayaran Baru"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resident_id">Penghuni</Label>
                <Select 
                  value={formData.resident_id} 
                  onValueChange={(value) => setFormData({ ...formData, resident_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih penghuni" />
                  </SelectTrigger>
                  <SelectContent>
                    {residents.map((resident) => (
                      <SelectItem key={resident.id} value={resident.id}>
                        {resident.full_name} - Kamar {resident.rooms.room_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Jumlah</Label>
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

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Menyimpan..." : selectedPayment ? "Perbarui" : "Simpan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Penghuni</TableHead>
                <TableHead>Kamar</TableHead>
                <TableHead>Bulan</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments
                .slice()
                .sort((a, b) => (a.residents.rooms.room_number || 0) - (b.residents.rooms.room_number || 0))
                .map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.residents.full_name}</TableCell>
                    <TableCell>Kamar {payment.residents.rooms.room_number}</TableCell>
                    <TableCell>{payment.payment_month}</TableCell>
                    <TableCell>{format(new Date(payment.payment_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>Rp {payment.amount.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateReceiptPDF(payment)}
                          title="Download Kwitansi"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShareWhatsapp(payment)}
                          title="Bagikan via WhatsApp"
                          disabled={uploadingId === payment.id}
                        >
                          <WhatsappIcon style={{ width: 18, height: 18 }} />
                          {uploadingId === payment.id ? '...' : ''}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(payment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
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
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}