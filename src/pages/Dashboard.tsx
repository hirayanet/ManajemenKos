import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, CreditCard, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalRooms: number;
  occupiedRooms: number;
  totalResidents: number;
  monthlyPayments: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    occupiedRooms: 0,
    totalResidents: 0,
    monthlyPayments: 0,
  });
  const [recentResidents, setRecentResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get room statistics
        const { data: rooms } = await supabase.from("rooms").select("*");
        const { data: residents } = await supabase
          .from("residents")
          .select("*, rooms(room_number)")
          .eq("is_active", true);

        // Get current month payments
        const currentMonth = new Date().toISOString().slice(0, 7); // Format: YYYY-MM
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("payment_month", currentMonth);

        // Calculate stats
        const totalRooms = rooms?.length || 0;
        const occupiedRooms = rooms?.filter(room => room.is_occupied).length || 0;
        const totalResidents = residents?.length || 0;
        const monthlyPayments = payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;

        setStats({
          totalRooms,
          occupiedRooms,
          totalResidents,
          monthlyPayments,
        });

        // Get recent residents (last 5)
        const { data: recentResidentsData } = await supabase
          .from("residents")
          .select("*, rooms(room_number)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentResidents(recentResidentsData || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {((stats.occupiedRooms / stats.totalRooms) * 100).toFixed(1)}% tingkat hunian
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