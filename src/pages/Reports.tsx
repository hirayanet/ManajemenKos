import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, TrendingUp, Users, Home, DollarSign } from "lucide-react";
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
    const { data, error } = await supabase
      .from("payments")
      .select("payment_month, amount")
      .gte("payment_date", `${selectedYear}-01-01`)
      .lt("payment_date", `${parseInt(selectedYear) + 1}-01-01`);

    if (error) throw error;

    const monthlyIncome = months.map(month => {
      const monthPayments = data?.filter(p => p.payment_month === month) || [];
      return {
        month,
        income: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        payments: monthPayments.length,
      };
    });

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Laporan</h1>
        <div className="flex space-x-2">
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
          <Button onClick={generatePDFReport} variant="outline">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pendapatan</p>
                <p className="text-2xl font-bold">Rp {totalIncome.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pengeluaran</p>
                <p className="text-2xl font-bold">Rp {totalExpenses.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Penghuni Aktif</p>
                <p className="text-2xl font-bold">{totalResidents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Home className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Tingkat Hunian</p>
                <p className="text-2xl font-bold">{occupancyRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Rata-rata Pendapatan</p>
                <p className="text-2xl font-bold">
                  Rp {Math.round(totalIncome / 12).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Rata-rata Pengeluaran</p>
                <p className="text-2xl font-bold">
                  Rp {Math.round(totalExpenses / 12).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

    {/* Monthly Data Table */}
    <Card>
      <CardHeader>
        <CardTitle>Detail Pendapatan & Pengeluaran per Bulan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead>Jumlah Pembayaran</TableHead>
                <TableHead>Total Pendapatan</TableHead>
                <TableHead>Total Pengeluaran</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((month, idx) => (
                <TableRow key={month.month}>
                  <TableCell className="font-medium">{month.month}</TableCell>
                  <TableCell>{month.payments}</TableCell>
                  <TableCell>Rp {month.income.toLocaleString("id-ID")}</TableCell>
                  <TableCell>Rp {monthlyExpenses[idx].toLocaleString("id-ID")}</TableCell>
                  <TableCell>
                    <Badge variant={month.income > 0 ? "default" : "secondary"}>
                      {month.income > 0 ? "Ada Pendapatan" : "Tidak Ada"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
      </div>
  </div>
);
}