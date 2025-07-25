import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, CreditCard, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast"; // Add this import

interface DashboardStats {
  totalRooms: number;
  occupiedRooms: number;
  totalResidents: number;
  monthlyPayments: number;
  monthlyExpenses: number;
  monthlyProfit: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    occupiedRooms: 0,
    totalResidents: 0,
    monthlyPayments: 0,
    monthlyExpenses: 0,
    monthlyProfit: 0,
  });
  const [recentResidents, setRecentResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get room statistics
        const { data: rooms, error: roomsError } = await supabase.from("rooms").select("*");
        if (roomsError) throw roomsError;
        
        // Get active residents
        let residentsQuery = supabase
          .from("residents")
          .select("*, rooms(room_number)");
        
        // Coba gunakan status_penghuni, jika error gunakan is_active
        let residents;
        try {
          const { data: residentsData, error } = await residentsQuery
            .eq("status_penghuni", "Aktif");
          if (error) throw error;
          residents = residentsData;
          // Proses data residents
        } catch (error) {
          console.warn("Fallback to is_active filter", error);
          const { data: residentsData } = await supabase
            .from("residents")
            .select("*, rooms(room_number)")
            .eq("is_active", true);
          residents = residentsData;
          // Proses data residents
        }

        // Get current month payments (by month name and year)
        const today = new Date();
        const currentMonth = today.getMonth(); // 0-based
        const currentYear = today.getFullYear();
        const months = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const currentMonthName = months[currentMonth];
        // Ambil pembayaran bulan berjalan
        const { data: payments } = await supabase
          .from("payments")
          .select("amount, payment_date")
          .eq("payment_month", currentMonthName)
          .filter('payment_date', 'gte', `${currentYear}-01-01`);

        // Get current month expenses
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("amount, expense_date")
          .gte("expense_date", firstDay.toISOString().slice(0, 10))
          .lte("expense_date", lastDay.toISOString().slice(0, 10));
        const monthlyExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        // Calculate stats
        const totalRooms = rooms?.length || 0;
        const occupiedRooms = rooms?.filter(room => room.is_occupied).length || 0;
        const totalResidents = residents?.length || 0;
        const monthlyPayments = payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
        const monthlyProfit = monthlyPayments - monthlyExpenses;

        setStats({
          totalRooms,
          occupiedRooms,
          totalResidents,
          monthlyPayments,
          monthlyExpenses,
          monthlyProfit,
        });

        // Get recent residents (last 5)
        const { data: recentResidentsData } = await supabase
          .from("residents")
          .select("*, rooms(room_number)")
          .eq("status_penghuni", "Aktif") // Ubah dari is_active ke status_penghuni
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentResidents(recentResidentsData || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast({
          title: "Error",
          description: "Gagal memuat data dashboard. Silakan coba lagi.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan data kos-kosan Anda
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kamar</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRooms}</div>
            <p className="text-xs text-muted-foreground">
              {stats.occupiedRooms} terisi, {stats.totalRooms - stats.occupiedRooms} kosong
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penghuni Aktif</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResidents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalRooms ? ((stats.occupiedRooms / stats.totalRooms) * 100).toFixed(1) : 0}% tingkat hunian
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kamar Terisi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupiedRooms}</div>
            <p className="text-xs text-muted-foreground">
              dari {stats.totalRooms} kamar tersedia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pemasukan Bulan Ini</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {stats.monthlyPayments.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">
              Pembayaran bulan {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pengeluaran Bulan Ini</CardTitle>
            <CreditCard className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              Rp {stats.monthlyExpenses.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">
              Pengeluaran bulan {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba/Rugi Bulan Ini</CardTitle>
            <CreditCard className={"h-4 w-4 " + (stats.monthlyProfit >= 0 ? "text-green-600" : "text-red-600")} />
          </CardHeader>
          <CardContent>
            <div className={"text-2xl font-bold " + (stats.monthlyProfit >= 0 ? "text-green-600" : "text-red-600")}> 
              Rp {stats.monthlyProfit.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground">
              Selisih pemasukan - pengeluaran bulan ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Residents */}
      <Card>
        <CardHeader>
          <CardTitle>Penghuni Terbaru</CardTitle>
          <CardDescription>
            5 penghuni yang baru saja masuk
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentResidents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Belum ada penghuni terdaftar
            </p>
          ) : (
            <div className="space-y-4">
              {recentResidents.map((resident) => (
                <div key={resident.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{resident.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {resident.phone_number}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">
                      Kamar {resident.rooms?.room_number}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Masuk: {new Date(resident.entry_date).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;