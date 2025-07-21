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
import { format } from "date-fns";
import jsPDF from "jspdf";

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
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          residents (
            full_name,
            rooms (room_number)
          )
        `)
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

  const fetchResidents = async () => {
    try {
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
      setResidents(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data penghuni",
        variant: "destructive",
      });
    }
  };

  const generateReceiptPDF = (payment: Payment) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("KWITANSI PEMBAYARAN", 105, 30, { align: "center" });
    
    doc.setFontSize(16);
    doc.text("KOS BAHAGIA", 105, 45, { align: "center" });
    
    // Line
    doc.line(20, 55, 190, 55);
    
    // Content
    doc.setFontSize(12);
    doc.text("Telah terima dari:", 20, 75);
    doc.text(payment.residents.full_name, 70, 75);
    
    doc.text("Kamar:", 20, 90);
    doc.text(`Kamar ${payment.residents.rooms.room_number}`, 70, 90);
    
    doc.text("Untuk pembayaran:", 20, 105);
    doc.text(`Sewa Kos Bulan ${payment.payment_month}`, 70, 105);
    
    doc.text("Jumlah:", 20, 120);
    doc.text(`Rp ${payment.amount.toLocaleString("id-ID")}`, 70, 120);
    
    doc.text("Metode Pembayaran:", 20, 135);
    doc.text(payment.payment_method, 70, 135);
    
    doc.text("Tanggal:", 20, 150);
    doc.text(format(new Date(payment.payment_date), "dd MMMM yyyy"), 70, 150);
    
    // Footer
    doc.text("Pengelola Kos", 140, 200);
    doc.text("(_________________)", 140, 230);
    
    // Save PDF
    doc.save(`kwitansi-${payment.residents.full_name}-${payment.payment_month}.pdf`);
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
              {payments.map((payment) => (
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