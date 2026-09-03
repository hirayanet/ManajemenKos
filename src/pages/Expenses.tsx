import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Download, CalendarDays, Edit, Trash2, MoreVertical } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { useToast } from "../hooks/use-toast";
import jsPDF from "jspdf";

interface Expense {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  created_at: string;
}

const CATEGORIES = [
  "Uang Sampah",
  "Gaji Ema Tati",
  "Belanja",
  "Service",
  "Lain-lain"
];

// Warna chip per kategori — konsisten antara kartu mobile & tabel desktop
const CATEGORY_CHIP: Record<string, string> = {
  "Uang Sampah": "bg-slate-100 text-slate-700 border-slate-200",
  "Gaji Ema Tati": "bg-sky-100 text-sky-700 border-sky-200",
  "Belanja": "bg-amber-100 text-amber-700 border-amber-200",
  "Service": "bg-violet-100 text-violet-700 border-violet-200",
  "Lain-lain": "bg-rose-100 text-rose-700 border-rose-200",
};
const chipFor = (category: string) =>
  CATEGORY_CHIP[category] || "bg-gray-100 text-gray-700 border-gray-200";

const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [reportPeriod, setReportPeriod] = useState<"year" | "month">("year");
  const [yearlyExpenses, setYearlyExpenses] = useState<Expense[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ category: "", amount: "", expenseDate: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
    if (reportPeriod === "year") {
      fetchYearlyExpenses();
    } else {
      fetchMonthlyExpenses();
    }
  }, [selectedYear, selectedMonth, reportPeriod]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    setExpenses([]);
    setErrorMsg("");
    // Ambil tanggal hari ini
    const today = new Date();
    // Jika tanggal 1 jam 00:00-00:01, reset tampilan (tidak ada data)
    if (
      today.getDate() === 1 &&
      today.getHours() === 0 &&
      today.getMinutes() <= 1
    ) {
      setLoading(false);
      return;
    }
    // Hitung awal dan akhir bulan berjalan
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    // Akhir bulan = tanggal 1 bulan berikutnya - 1 hari
    const endDateObj = new Date(year, month, 0); // 0 = hari terakhir bulan ini
    const endDate = `${year}-${month.toString().padStart(2, "0")}-${endDateObj.getDate().toString().padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });
    if (error) {
      setErrorMsg("Gagal memuat data pengeluaran.");
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    if (!category || !amount || !expenseDate) {
      setErrorMsg("Kategori, jumlah, dan tanggal wajib diisi.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("expenses").insert([
      {
        category,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        description
      }
    ]);
    if (error) {
      setErrorMsg("Gagal menambah pengeluaran.");
    } else {
      setSuccessMsg("Pengeluaran berhasil ditambahkan.");
      setCategory("");
      setAmount("");
      setExpenseDate("");
      setDescription("");
      fetchExpenses();
    }
    setLoading(false);
  }

  const refreshLists = () => {
    fetchExpenses();
    if (reportPeriod === "year") {
      fetchYearlyExpenses();
    } else {
      fetchMonthlyExpenses();
    }
  };

  const openEditDialog = (exp: Expense) => {
    setEditingExpense(exp);
    setEditForm({
      category: exp.category,
      amount: String(exp.amount),
      expenseDate: exp.expense_date.slice(0, 10),
      description: exp.description || "",
    });
  };

  async function handleUpdateExpense() {
    if (!editingExpense) return;
    if (!editForm.category || !editForm.amount || !editForm.expenseDate) {
      toast({ title: "Form tidak lengkap", description: "Kategori, jumlah, dan tanggal wajib diisi", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("expenses")
      .update({
        category: editForm.category,
        amount: parseFloat(editForm.amount),
        expense_date: editForm.expenseDate,
        description: editForm.description,
      })
      .eq("id", editingExpense.id);
    if (error) {
      toast({ title: "Gagal menyimpan perubahan", description: "Terjadi kesalahan saat mengupdate pengeluaran", variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Pengeluaran berhasil diperbarui" });
    setEditingExpense(null);
    refreshLists();
  }

  async function handleDeleteExpense() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan saat menghapus pengeluaran", variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Pengeluaran berhasil dihapus" });
    setDeleteTarget(null);
    refreshLists();
  }

  async function fetchYearlyExpenses() {
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });
    
    if (error) {
      console.error("Error fetching yearly expenses:", error);
    } else {
      setYearlyExpenses(data || []);
    }
  }

  async function fetchMonthlyExpenses() {
    const startDate = `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
    const endDate = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });
    
    if (error) {
      console.error("Error fetching monthly expenses:", error);
    } else {
      setMonthlyExpenses(data || []);
    }
  }

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    if (reportPeriod === "year") {
      generateYearlyPDFReport(doc);
    } else {
      generateMonthlyPDFReport(doc);
    }
  };

  const generateYearlyPDFReport = (doc: jsPDF) => {
    // Header
    doc.setFontSize(20);
    doc.text("LAPORAN PENGELUARAN TAHUNAN KOS BAHAGIA", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`Tahun ${selectedYear}`, 105, 45, { align: "center" });
    
    // Line
    doc.line(20, 55, 190, 55);
    
    // Summary Stats
    const totalExpenses = yearlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expensesByCategory = CATEGORIES.map(cat => {
      const categoryExpenses = yearlyExpenses.filter(exp => exp.category === cat);
      return {
        category: cat,
        total: categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        count: categoryExpenses.length
      };
    }).filter(item => item.total > 0);
    
    doc.setFontSize(12);
    doc.text("RINGKASAN PENGELUARAN:", 20, 70);
    doc.text(`Total Pengeluaran: Rp ${totalExpenses.toLocaleString("id-ID")}`, 20, 85);
    doc.text(`Total Transaksi: ${yearlyExpenses.length} transaksi`, 20, 100);
    
    // Category breakdown
    doc.text("PENGELUARAN PER KATEGORI:", 20, 125);
    let yPos = 140;
    expensesByCategory.forEach(item => {
      doc.text(
        `${item.category}: Rp ${item.total.toLocaleString("id-ID")} (${item.count} transaksi)`,
        20,
        yPos
      );
      yPos += 15;
    });
    
    // Monthly breakdown
    yPos += 10;
    doc.text("PENGELUARAN PER BULAN:", 20, yPos);
    yPos += 15;
    
    for (let month = 1; month <= 12; month++) {
      const monthlyExpenses = yearlyExpenses.filter(exp => {
        const expenseMonth = new Date(exp.expense_date).getMonth() + 1;
        return expenseMonth === month;
      });
      
      if (monthlyExpenses.length > 0) {
        const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        doc.text(
          `${months[month - 1]}: Rp ${monthlyTotal.toLocaleString("id-ID")} (${monthlyExpenses.length} transaksi)`,
          20,
          yPos
        );
        yPos += 15;
        
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 30;
        }
      }
    }
    
    // Footer
    doc.text(`Dibuat pada: ${format(new Date(), "dd MMMM yyyy")}`, 20, 270);
    
    doc.save(`laporan-pengeluaran-tahunan-${selectedYear}.pdf`);
  };

  const generateMonthlyPDFReport = (doc: jsPDF) => {
    // Header
    doc.setFontSize(20);
    doc.text("LAPORAN PENGELUARAN BULANAN KOS BAHAGIA", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`${months[parseInt(selectedMonth) - 1]} ${selectedYear}`, 105, 45, { align: "center" });
    
    // Line
    doc.line(20, 55, 190, 55);
    
    // Summary Stats
    const totalExpenses = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const expensesByCategory = CATEGORIES.map(cat => {
      const categoryExpenses = monthlyExpenses.filter(exp => exp.category === cat);
      return {
        category: cat,
        total: categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        count: categoryExpenses.length
      };
    }).filter(item => item.total > 0);
    
    doc.setFontSize(12);
    doc.text("RINGKASAN PENGELUARAN:", 20, 70);
    doc.text(`Total Pengeluaran: Rp ${totalExpenses.toLocaleString("id-ID")}`, 20, 85);
    doc.text(`Total Transaksi: ${monthlyExpenses.length} transaksi`, 20, 100);
    
    // Category breakdown
    doc.text("PENGELUARAN PER KATEGORI:", 20, 125);
    let yPos = 140;
    expensesByCategory.forEach(item => {
      doc.text(
        `${item.category}: Rp ${item.total.toLocaleString("id-ID")} (${item.count} transaksi)`,
        20,
        yPos
      );
      yPos += 15;
    });
    
    // Daily breakdown
    yPos += 10;
    doc.text("DETAIL PENGELUARAN HARIAN:", 20, yPos);
    yPos += 15;
    
    // Group expenses by date
    const expensesByDate = monthlyExpenses.reduce((acc, exp) => {
      const date = exp.expense_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(exp);
      return acc;
    }, {} as Record<string, Expense[]>);
    
    // Sort dates
    const sortedDates = Object.keys(expensesByDate).sort();
    
    sortedDates.forEach(date => {
      const dailyExpenses = expensesByDate[date];
      const dailyTotal = dailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      doc.setFontSize(11);
      doc.text(`${format(parseISO(date), "dd MMMM yyyy")} - Total: Rp ${dailyTotal.toLocaleString("id-ID")}`, 20, yPos);
      yPos += 12;
      
      doc.setFontSize(10);
      dailyExpenses.forEach(exp => {
        const description = exp.description ? ` - ${exp.description}` : "";
        doc.text(`  • ${exp.category}: Rp ${exp.amount.toLocaleString("id-ID")}${description}`, 25, yPos);
        yPos += 10;
        
        // Check if we need a new page
        if (yPos > 260) {
          doc.addPage();
          yPos = 30;
        }
      });
      
      yPos += 5; // Extra space between dates
    });
    
    // Footer
    doc.text(`Dibuat pada: ${format(new Date(), "dd MMMM yyyy")}`, 20, 270);
    
    doc.save(`laporan-pengeluaran-${months[parseInt(selectedMonth) - 1]}-${selectedYear}.pdf`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold">Pengeluaran Bulanan Kosan</h1>
      </div>
      {/* Filters — stack on mobile, row on desktop */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <Select value={reportPeriod} onValueChange={(value: "year" | "month") => setReportPeriod(value)}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Tahunan</SelectItem>
              <SelectItem value="month">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reportPeriod === "month" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={generatePDFReport} variant="outline" className="w-full md:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <form onSubmit={handleAddExpense} className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Kategori</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Jumlah (Rp)</label>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" required />
        </div>
        <div>
          <label className="block mb-1 font-medium">Tanggal</label>
          <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
        </div>
        <div className="md:col-span-2">
          <label className="block mb-1 font-medium">Keterangan</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="md:col-span-2 flex gap-2 items-center">
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Tambah Pengeluaran"}
          </Button>
          {successMsg && <span className="text-green-600">{successMsg}</span>}
          {errorMsg && <span className="text-red-600">{errorMsg}</span>}
        </div>
      </form>
      {/* Mobile list (cards) */}
      <div className="block md:hidden space-y-3">
        {expenses.map((exp) => (
          <div key={exp.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${chipFor(exp.category)}`}>
                {(exp.category || "?").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{exp.category}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(parseISO(exp.expense_date), "d MMM yyyy", { locale: localeId })}
                </div>
              </div>
              <div className="font-bold text-rose-600 shrink-0">Rp {exp.amount.toLocaleString('id-ID')}</div>
            </div>
            <div className="mt-3 border-t border-dashed pt-3 space-y-2">
              {exp.description && (
                <p className="text-sm text-muted-foreground">{exp.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => openEditDialog(exp)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-full bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:text-destructive" onClick={() => setDeleteTarget(exp)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                </Button>
              </div>
            </div>
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="text-center text-muted-foreground py-2">Belum ada data pengeluaran.</div>
        )}
      </div>

      {/* Desktop/tablet table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>            <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Kategori</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map(exp => (
              <TableRow key={exp.id} className="hover:bg-muted/40 transition-colors">
                <TableCell>
                  <span className={`inline-flex text-xs font-semibold border rounded-full px-2.5 py-1 ${chipFor(exp.category)}`}>
                    {exp.category}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(parseISO(exp.expense_date), "d MMM yyyy", { locale: localeId })}
                </TableCell>
                <TableCell className="text-right font-semibold text-rose-600 whitespace-nowrap">Rp {exp.amount.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{exp.description || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-primary/20 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-white" title="Aksi pengeluaran" aria-label="Aksi pengeluaran">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEditDialog(exp)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit Data
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(exp)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Hapus Pengeluaran
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Belum ada data pengeluaran.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Edit Pengeluaran */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => { if (!open) setEditingExpense(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Pengeluaran</DialogTitle>
            <DialogDescription>
              Perbarui detail pengeluaran di bawah ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Jumlah (Rp)</Label>
                <Input id="edit-amount" type="number" min="0" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Tanggal</Label>
                <Input id="edit-date" type="date" value={editForm.expenseDate} onChange={(e) => setEditForm({ ...editForm, expenseDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Keterangan</Label>
              <Textarea id="edit-desc" rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingExpense(null)}>Batal</Button>
              <Button onClick={handleUpdateExpense} disabled={loading}>Simpan Perubahan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengeluaran</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pengeluaran "{deleteTarget?.category}" sebesar Rp {deleteTarget ? deleteTarget.amount.toLocaleString("id-ID") : ""}? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
