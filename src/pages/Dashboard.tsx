import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

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

        let residents;
        try {
          const { data: residentsData, error } = await residentsQuery
            .eq("status_penghuni", "Aktif");
          if (error) throw error;
          residents = residentsData;

        } catch (error) {
          console.warn("Fallback to is_active filter", error);
          const { data: residentsData } = await supabase
            .from("residents")
            .select("*, rooms(room_number)")
            .eq("is_active", true);
          residents = residentsData;

        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const months = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const currentMonthName = months[currentMonth];

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
          .eq("status_penghuni", "Aktif")
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

  const formatRupiah = (value: number) =>
    `Rp ${value.toLocaleString("id-ID")}`;

  const monthLabel = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Ringkasan data kos-kosan Anda
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Home className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Total Kamar</span>
            </div>
            <div className="text-xl md:text-2xl font-bold mt-1">{stats.totalRooms}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{stats.occupiedRooms} terisi</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Penghuni</span>
            </div>
            <div className="text-xl md:text-2xl font-bold mt-1">{stats.totalResidents}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              {stats.totalRooms ? ((stats.occupiedRooms / stats.totalRooms) * 100).toFixed(0) : 0}% hunian
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Terisi</span>
            </div>
            <div className="text-xl md:text-2xl font-bold mt-1">{stats.occupiedRooms}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">dari {stats.totalRooms}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-green-500/10">
                <CreditCard className="h-3.5 w-3.5 text-green-500" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Pemasukan</span>
            </div>
            <div className="text-lg md:text-2xl font-bold mt-1">{formatRupiah(stats.monthlyPayments)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Pengeluaran</span>
            </div>
            <div className="text-lg md:text-2xl font-bold mt-1 text-red-600">{formatRupiah(stats.monthlyExpenses)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-md ${stats.monthlyProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {stats.monthlyProfit >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
              <span className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">Laba/Rugi</span>
            </div>
            <div className={`text-lg md:text-2xl font-bold mt-1 ${stats.monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatRupiah(stats.monthlyProfit)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Bulan ini</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Residents */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Penghuni Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {recentResidents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">
              Belum ada penghuni terdaftar
            </p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {recentResidents.map((resident) => (
                <div key={resident.id} className="flex items-center justify-between p-3 border rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {resident.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{resident.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{resident.phone_number}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <Badge variant="secondary" className="text-xs">Kmr {resident.rooms?.room_number}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(resident.entry_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
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