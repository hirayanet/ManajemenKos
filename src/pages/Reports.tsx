import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, TrendingUp, TrendingDown, CalendarDays, Users, Home, DollarSign, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import jsPDF from "jspdf";

interface MonthlyReport {
  month: string;
  income: number;
  payments: number;
}

interface OccupancyData {
  name: string;
  value: number;
  color: string;
}

export default function Reports() {
  const [monthlyData, setMonthlyData] = useState<MonthlyReport[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number[]>(Array(12).fill(0));
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalResidents, setTotalResidents] = useState(0);
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    fetchReportData();
  }, [selectedYear]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchMonthlyIncome(),
        fetchMonthlyExpenses(),
        fetchOccupancyData(),
        fetchSummaryStats(),
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data laporan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyIncome = async () => {
    // Ambil pembayaran pada tahun terpilih: bulanan dicari lewat payment_date, harian
    // lewat periode_mulai (periode sewa mulai pada tahun terpilih).
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${parseInt(selectedYear) + 1}-01-01`;
    const { data, error } = await supabase
      .from("payments")
      .select("payment_month, amount, periode_mulai")
      .or(`and(payment_date.gte.${yearStart},payment_date.lt.${yearEnd}),and(periode_mulai.gte.${yearStart},periode_mulai.lt.${yearEnd})`);

    if (error) throw error;

    // Bulanan: dihitung ke bulan sesuai payment_month (nama bulan), tahun mengikuti
    // payment_date seperti sebelumnya. Harian: dihitung utuh ke bulan periode_mulai
    // (keseluruhan ke bulan mulai) agar akurat lintas bulan/tahun tanpa dobel-hitung.
    const yearNum = parseInt(selectedYear);
    const sums = Array(12).fill(0);
    const counts = Array(12).fill(0);
    (data || []).forEach((p) => {
      let bucket = -1;
      if (p.periode_mulai) {
        const start = new Date(p.periode_mulai + "T00:00:00");
        if (start.getFullYear() === yearNum) bucket = start.getMonth();
      } else {
        bucket = months.indexOf(p.payment_month);
      }
      if (bucket >= 0 && bucket < 12) {
        sums[bucket] += Number(p.amount);
        counts[bucket] += 1;
      }
    });

    const monthlyIncome = months.map((month, i) => ({
      month,
      income: sums[i],
      payments: counts[i],
    }));

    setMonthlyData(monthlyIncome);
    setTotalIncome(monthlyIncome.reduce((sum, m) => sum + m.income, 0));
  };

  // Fetch monthly expenses for each month in selected year
  const fetchMonthlyExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("expense_date, amount")
      .gte("expense_date", `${selectedYear}-01-01`)
      .lt("expense_date", `${parseInt(selectedYear) + 1}-01-01`);
    if (error) throw error;
    const expensesByMonth = Array(12).fill(0);
    data?.forEach(exp => {
      const date = new Date(exp.expense_date);
      const monthIdx = date.getMonth(); // 0-based
      expensesByMonth[monthIdx] += exp.amount;
    });
    setMonthlyExpenses(expensesByMonth);
    setTotalExpenses(expensesByMonth.reduce((sum, val) => sum + val, 0));
  };

  const fetchOccupancyData = async () => {
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, is_occupied");

    if (error) throw error;

    const occupied = rooms?.filter(r => r.is_occupied).length || 0;
    const vacant = (rooms?.length || 0) - occupied;
    const rate = rooms?.length ? (occupied / rooms.length) * 100 : 0;

    setOccupancyRate(rate);
    setOccupancyData([
      { name: "Terisi", value: occupied, color: "#8884d8" },
      { name: "Kosong", value: vacant, color: "#82ca9d" },
    ]);
  };

  const fetchSummaryStats = async () => {
    const { data: residents, error } = await supabase
      .from("residents")
      .select("id")
      .eq("is_active", true);

    if (error) throw error;
    setTotalResidents(residents?.length || 0);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("LAPORAN BULANAN KOS BAHAGIA", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`Tahun ${selectedYear}`, 105, 45, { align: "center" });
    
    // Line
    doc.line(20, 55, 190, 55);
    
    // Summary Stats
    doc.setFontSize(12);
    doc.text("RINGKASAN:", 20, 70);
    doc.text(`Total Pendapatan: Rp ${totalIncome.toLocaleString("id-ID")}`, 20, 85);
    doc.text(`Total Pengeluaran: Rp ${totalExpenses.toLocaleString("id-ID")}`, 20, 100);
    doc.text(`Total Penghuni Aktif: ${totalResidents} orang`, 20, 115);
    doc.text(`Tingkat Hunian: ${occupancyRate.toFixed(1)}%`, 20, 130);
    
    // Monthly Data Table
    doc.text("PENDAPATAN & PENGELUARAN PER BULAN:", 20, 155);
    
    let yPos = 170;
    monthlyData.forEach((month, index) => {
      if (month.income > 0) {
        doc.text(
          `${month.month}: Rp ${month.income.toLocaleString("id-ID")} (${month.payments} pembayaran) - Pengeluaran: Rp ${monthlyExpenses[index].toLocaleString("id-ID")}`,
          20,
          yPos
        );
        yPos += 15;
      }
    });
    
    // Footer
    doc.text(`Dibuat pada: ${format(new Date(), "dd MMMM yyyy")}`, 20, 270);
    
    doc.save(`laporan-kos-${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-foreground">Laporan</h1>
        <div className="flex gap-2">
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
          <Button onClick={generatePDFReport} variant="outline" className="flex-1 md:flex-none">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-sm">Memuat data…</div>
        </div>
      )}

      <div className={isLoading ? 'hidden' : ''}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {[
          {
            label: "Pendapatan",
            value: `Rp ${totalIncome.toLocaleString("id-ID")}`,
            sub: `Tahun ${selectedYear}`,
            icon: DollarSign,
            tint: "bg-emerald-500/10 text-emerald-600",
          },
          {
            label: "Pengeluaran",
            value: `Rp ${totalExpenses.toLocaleString("id-ID")}`,
            sub: `Tahun ${selectedYear}`,
            icon: TrendingDown,
            tint: "bg-red-500/10 text-red-500",
          },
          {
            label: "Penghuni",
            value: String(totalResidents),
            sub: "aktif",
            icon: Users,
            tint: "bg-blue-500/10 text-blue-500",
          },
          {
            label: "Tingkat Hunian",
            value: `${occupancyRate.toFixed(1)}%`,
            sub: `${occupancyData[0]?.value ?? 0} dari ${(occupancyData[0]?.value ?? 0) + (occupancyData[1]?.value ?? 0)} kamar terisi`,
            icon: Home,
            tint: "bg-amber-500/10 text-amber-500",
          },
          {
            label: "Rata-rata Pendapatan",
            value: `Rp ${Math.round(totalIncome / 12).toLocaleString("id-ID")}`,
            sub: "per bulan",
            icon: TrendingUp,
            tint: "bg-violet-500/10 text-violet-600",
          },
          {
            label: "Rata-rata Pengeluaran",
            value: `Rp ${Math.round(totalExpenses / 12).toLocaleString("id-ID")}`,
            sub: "per bulan",
            icon: Wallet,
            tint: "bg-rose-500/10 text-rose-500",
          },
        ].map(({ label, value, sub, icon: Icon, tint }) => (
          <Card key={label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
                  {label}
                </p>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xl md:text-2xl font-bold mt-2 truncate">{value}</p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-1 truncate">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pendapatan Bulanan {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip 
                  formatter={(value: number) => [`Rp ${value.toLocaleString("id-ID")}`, "Pendapatan"]}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pengeluaran Bulanan {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={months.map((month, idx) => ({ month, expense: monthlyExpenses[idx] }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip 
                  formatter={(value: number) => [`Rp ${value.toLocaleString("id-ID")}`, "Pengeluaran"]}
                />
                <Bar dataKey="expense" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Hunian Kamar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>


    </div>

    {/* Monthly Data — Mobile cards */}
    <Card className="shadow-sm">
      <CardHeader className="pb-2 md:pb-4">
        <CardTitle className="text-base md:text-lg">Detail per Bulan</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Mobile card list */}
        <div className="block md:hidden space-y-2">
          {monthlyData.map((month, idx) => {
            const hasIncome = month.income > 0;
            return (
              <div key={month.month} className="rounded-xl border bg-card p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">{month.month}</p>
                      <p className="text-xs text-muted-foreground">{month.payments} pembayaran</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-emerald-600">+Rp {month.income.toLocaleString("id-ID")}</p>
                    <p className="text-sm font-semibold text-red-500">-Rp {monthlyExpenses[idx].toLocaleString("id-ID")}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {hasIncome ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <TrendingUp className="h-3 w-3" />
                      Ada Pendapatan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-400/10">
                      <TrendingDown className="h-3 w-3" />
                      Tidak Ada
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11">Bulan</TableHead>
                <TableHead className="h-11 text-center">Jumlah Pembayaran</TableHead>
                <TableHead className="h-11 text-right">Total Pendapatan</TableHead>
                <TableHead className="h-11 text-right">Total Pengeluaran</TableHead>
                <TableHead className="h-11 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((month, idx) => {
                const hasIncome = month.income > 0;
                return (
                  <TableRow key={month.month} className="group">
                    <TableCell className="text-sm font-semibold">{month.month}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                        {month.payments}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-emerald-600">
                      Rp {month.income.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-red-500">
                      Rp {monthlyExpenses[idx].toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasIncome ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          <TrendingUp className="h-3 w-3" />
                          Ada Pendapatan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-400/10">
                          <TrendingDown className="h-3 w-3" />
                          Tidak Ada
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
      </div>
  </div>
);
}