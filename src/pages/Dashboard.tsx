import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
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

        // Ambil pembayaran tahun berjalan: bulanan dicari lewat payment_date, harian
        // lewat periode_mulai (periode sewa mulai tahun ini).
        const { data: payments } = await supabase
          .from("payments")
          .select("amount, payment_month, periode_mulai")
          .or(`payment_date.gte.${currentYear}-01-01,periode_mulai.gte.${currentYear}-01-01`);

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
        // Bulanan: payment_month = nama bulan berjalan. Harian: periode_mulai (kolom
        // tanggal periode sewa) jatuh pada bulan & tahun berjalan — akurat lintas bulan/tahun.
        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
        const isPaymentForCurrentMonth = (payment: { payment_month: string; periode_mulai: string | null }) => {
          if (payment.periode_mulai) return payment.periode_mulai.startsWith(monthPrefix);
          return payment.payment_month === currentMonthName;
        };
        const monthlyPayments = (payments || [])
          .filter(isPaymentForCurrentMonth)
          .reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {[
          {
            label: "Total Kamar",
            value: String(stats.totalRooms),
            sub: `${stats.occupiedRooms} terisi`,
            icon: TrendingUp,
            tint: "bg-primary/10 text-primary",
          },
          {
            label: "Penghuni",
            value: String(stats.totalResidents),
            sub: stats.totalRooms ? `${Math.round((stats.occupiedRooms / stats.totalRooms) * 100)}% hunian` : "0% hunian",
            icon: Users,
            tint: "bg-blue-500/10 text-blue-500",
          },
          {
            label: "Kamar Terisi",
            value: String(stats.occupiedRooms),
            sub: `dari ${stats.totalRooms} kamar`,
            icon: Home,
            tint: "bg-amber-500/10 text-amber-500",
          },
          {
            label: "Pemasukan",
            value: formatRupiah(stats.monthlyPayments),
            sub: monthLabel,
            icon: CreditCard,
            tint: "bg-emerald-500/10 text-emerald-600",
          },
          {
            label: "Pengeluaran",
            value: formatRupiah(stats.monthlyExpenses),
            sub: monthLabel,
            icon: TrendingDown,
            tint: "bg-red-500/10 text-red-500",
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
        {/* Laba/Rugi */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
                Laba/Rugi
              </p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${stats.monthlyProfit >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                {stats.monthlyProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </div>
            <p className={`text-xl md:text-2xl font-bold mt-2 truncate ${stats.monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatRupiah(stats.monthlyProfit)}
            </p>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-1 truncate">Bulan ini</p>
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
                    <InitialsAvatar
                      name={resident.full_name || "-"}
                      seed={resident.rooms?.room_number}
                      className="h-9 w-9 text-xs"
                    />
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