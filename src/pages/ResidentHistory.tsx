import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMonths, differenceInDays } from "date-fns";

interface ResidentHistory {
  id: string;
  full_name: string;
  room_id: number;
  entry_date: string;
  tanggal_keluar: string;
  rooms: { room_number: number };
}

export default function ResidentHistory() {
  const [history, setHistory] = useState<ResidentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("residents")
        .select(`
          id,
          full_name,
          room_id,
          entry_date,
          tanggal_keluar,
          rooms (room_number)
        `)
        .eq("status_penghuni", "Sudah Keluar")
        .order("tanggal_keluar", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data riwayat penghuni",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStayDuration = (entryDate: string, exitDate: string) => {
    const start = new Date(entryDate);
    const end = new Date(exitDate);
    
    const months = differenceInMonths(end, start);
    const remainingDays = differenceInDays(end, new Date(start.setMonth(start.getMonth() + months)));
    
    if (months > 0) {
      return `${months} bulan${remainingDays > 0 ? ` ${remainingDays} hari` : ''}`;
    } else {
      return `${differenceInDays(end, new Date(entryDate))} hari`;
    }
  };

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
        <h1 className="text-3xl font-bold text-foreground">Riwayat Penghuni</h1>
        <p className="text-muted-foreground">
          Daftar penghuni yang sudah keluar dari kos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penghuni</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Belum ada data riwayat penghuni
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kamar</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                  <TableHead>Tanggal Keluar</TableHead>
                  <TableHead>Lama Tinggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell className="font-medium">{resident.full_name}</TableCell>
                    <TableCell>Kamar {resident.rooms.room_number}</TableCell>
                    <TableCell>{format(new Date(resident.entry_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(resident.tanggal_keluar), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      {calculateStayDuration(resident.entry_date, resident.tanggal_keluar)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}