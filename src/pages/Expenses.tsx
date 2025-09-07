import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
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
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Pengeluaran Bulanan Kosan</h1>
        <div className="flex space-x-2">
          <Select value={reportPeriod} onValueChange={(value: "year" | "month") => setReportPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Tahunan</SelectItem>
              <SelectItem value="month">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
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
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={generatePDFReport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
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
          <div key={exp.id} className="rounded-lg border p-4 bg-card text-card-foreground">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{exp.category}</div>
                <div className="text-xs text-muted-foreground">{format(parseISO(exp.expense_date), "dd/MM/yyyy")}</div>
              </div>
              <div className="font-semibold">Rp {exp.amount.toLocaleString('id-ID')}</div>
            </div>
            {exp.description && (
              <div className="mt-2 text-sm text-muted-foreground">{exp.description}</div>
            )}
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="text-center text-muted-foreground py-2">Belum ada data pengeluaran.</div>
        )}
      </div>

      {/* Desktop/tablet table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Tanggal</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Jumlah</th>
              <th className="border px-2 py-1">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td className="border px-2 py-1">{format(parseISO(exp.expense_date), "dd/MM/yyyy")}</td>
                <td className="border px-2 py-1">{exp.category}</td>
                <td className="border px-2 py-1">Rp {exp.amount.toLocaleString("id-ID")}</td>
                <td className="border px-2 py-1">{exp.description || "-"}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={4} className="text-center py-2">Belum ada data pengeluaran.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
