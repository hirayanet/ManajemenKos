import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMonths, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus } from "lucide-react";

interface ResidentHistory {
  id: string;
  full_name: string;
  room_id: number;
  entry_date: string;
  tanggal_keluar: string;
  rooms: { room_number: number };
}

export default function ResidentHistory() {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const [history, setHistory] = useState<ResidentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Search & Filter States
  const [searchName, setSearchName] = useState("");
  const [filterMonth, setFilterMonth] = useState("Semua");
  const [filterYear, setFilterYear] = useState("Semua");

  // Rent Again States
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomOccupancy, setRoomOccupancy] = useState<{ [roomId: number]: number }>({});
  const [isRentAgainOpen, setIsRentAgainOpen] = useState(false);
  const [selectedExResident, setSelectedExResident] = useState<ResidentHistory | null>(null);
  const [newRoomId, setNewRoomId] = useState("");
  const [newEntryDate, setNewEntryDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const fetchAvailableRoomsAndOccupancy = async () => {
    try {
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("*")
        .order("room_number");
      
      const { data: activeResidents } = await supabase
        .from("residents")
        .select("room_id")
        .eq("status_penghuni", "Aktif");

      const occ: { [roomId: number]: number } = {};
      activeResidents?.forEach((r) => {
        occ[r.room_id] = (occ[r.room_id] || 0) + 1;
      });

      setRooms(roomsData || []);
      setRoomOccupancy(occ);
    } catch (err) {
      console.error("Gagal mengambil data kamar:", err);
    }
  };

  const handleOpenRentAgain = async (resident: ResidentHistory) => {
    setSelectedExResident(resident);
    setNewRoomId("");
    setNewEntryDate(new Date().toISOString().split('T')[0]); // default to today
    await fetchAvailableRoomsAndOccupancy();
    setIsRentAgainOpen(true);
  };

  const handleRentAgainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExResident || !newRoomId || !newEntryDate) {
      toast({
        title: "Error",
        description: "Kamar dan tanggal masuk wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Ambil data lengkap mantan penghuni
      const { data: fullResident, error: fetchErr } = await supabase
        .from("residents")
        .select("*")
        .eq("id", selectedExResident.id)
        .single();

      if (fetchErr || !fullResident) {
        throw new Error("Gagal mengambil data mantan penghuni");
      }

      // 2. Insert record baru ke database
      const { error: insertErr } = await supabase
        .from("residents")
        .insert({
          full_name: fullResident.full_name,
          phone_number: fullResident.phone_number,
          room_id: parseInt(newRoomId),
          entry_date: newEntryDate,
          is_active: true,
          status_penghuni: "Aktif",
          marital_status: fullResident.marital_status || "Lajang",
          ktp_image_url: fullResident.ktp_image_url || null,
          marriage_document_url: fullResident.marriage_document_url || null,
        });

      if (insertErr) throw insertErr;

      toast({
        title: "Berhasil",
        description: `${fullResident.full_name} berhasil didaftarkan kembali ke kamar baru`,
      });

      setIsRentAgainOpen(false);
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memproses pendaftaran",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

  const filteredHistory = useMemo(() => {
    return history.filter((resident) => {
      // 1. Filter Nama
      const matchesName = resident.full_name.toLowerCase().includes(searchName.toLowerCase());

      if (!resident.tanggal_keluar) return matchesName;

      // Parse exit date
      const exitDate = new Date(resident.tanggal_keluar);

      // 2. Filter Bulan
      let matchesMonth = true;
      if (filterMonth !== "Semua") {
        const monthIdx = exitDate.getMonth();
        matchesMonth = months[monthIdx] === filterMonth;
      }

      // 3. Filter Tahun
      let matchesYear = true;
      if (filterYear !== "Semua") {
        matchesYear = exitDate.getFullYear().toString() === filterYear;
      }

      return matchesName && matchesMonth && matchesYear;
    });
  }, [history, searchName, filterMonth, filterYear]);

  const displayedHistory = useMemo(() => {
    return filteredHistory.slice(0, 20);
  }, [filteredHistory]);

  const availableRooms = useMemo(() => {
    return rooms.filter((room) => {
      const occ = roomOccupancy[room.id] || 0;
      const capacity = room.room_number >= 7 && room.room_number <= 15 ? 2 : 1;
      return occ < capacity;
    });
  }, [rooms, roomOccupancy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Riwayat Penghuni</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar penghuni yang sudah keluar dari kos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama penghuni..."
              className="pl-8 w-full"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          {/* Month Filter */}
          <div className="w-full sm:w-40">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Bulan Keluar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua Bulan</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Year Filter */}
          <div className="w-full sm:w-28">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger>
                <SelectValue placeholder="Tahun Keluar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua Tahun</SelectItem>
                {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penghuni</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Tidak ada data riwayat penghuni yang cocok
            </p>
          ) : (
            <>
              {filteredHistory.length > 20 && (
                <div className="text-xs text-muted-foreground mb-3 text-right">
                  Menampilkan 20 dari {filteredHistory.length} riwayat. Gunakan pencarian nama untuk menyaring lebih spesifik.
                </div>
              )}
              {/* Mobile list (cards) */}
              <div className="block md:hidden space-y-3">
                {displayedHistory.map((resident) => (
                  <div key={resident.id} className="rounded-lg border p-4 bg-card text-card-foreground">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{resident.full_name}</div>
                        <div className="text-sm text-muted-foreground">Kamar {resident.rooms.room_number}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-xs text-muted-foreground">Masuk: {format(new Date(resident.entry_date), 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-muted-foreground">Keluar: {format(new Date(resident.tanggal_keluar), 'dd/MM/yyyy')}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm flex justify-between items-center pt-2 border-t">
                      <div>
                        Lama tinggal: <span className="font-medium">{calculateStayDuration(resident.entry_date, resident.tanggal_keluar)}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleOpenRentAgain(resident)} className="flex items-center gap-1">
                        <UserPlus className="h-4 w-4" /> Kos Lagi
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/tablet table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kamar</TableHead>
                      <TableHead>Tanggal Masuk</TableHead>
                      <TableHead>Tanggal Keluar</TableHead>
                      <TableHead>Lama Tinggal</TableHead>
                      <TableHead className="w-32">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedHistory.map((resident) => (
                      <TableRow key={resident.id}>
                        <TableCell className="font-medium">{resident.full_name}</TableCell>
                        <TableCell>Kamar {resident.rooms.room_number}</TableCell>
                        <TableCell>{format(new Date(resident.entry_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(resident.tanggal_keluar), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {calculateStayDuration(resident.entry_date, resident.tanggal_keluar)}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenRentAgain(resident)} className="flex items-center gap-1">
                            <UserPlus className="h-4 w-4" /> Kos Lagi
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Kos Lagi */}
      <Dialog open={isRentAgainOpen} onOpenChange={setIsRentAgainOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mulai Sewa Baru (Kos Lagi)</DialogTitle>
            <DialogDescription>
              Daftarkan kembali **{selectedExResident?.full_name}** sebagai penghuni aktif di kamar yang baru.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRentAgainSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Penghuni</Label>
              <Input value={selectedExResident?.full_name || ""} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new_room">Pilih Kamar Baru</Label>
              <Select value={newRoomId} onValueChange={setNewRoomId} required>
                <SelectTrigger id="new_room">
                  <SelectValue placeholder="Pilih kamar tersedia" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.length === 0 ? (
                    <div className="px-2 py-1 text-sm text-muted-foreground">Tidak ada kamar tersedia</div>
                  ) : (
                    availableRooms.map((room) => {
                      const capacity = room.room_number >= 7 && room.room_number <= 15 ? 2 : 1;
                      const occ = roomOccupancy[room.id] || 0;
                      const slotText = capacity > 1 ? ` (Tersisa ${capacity - occ} slot)` : "";
                      return (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          Kamar {room.room_number}{slotText}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_entry_date">Tanggal Masuk Baru</Label>
              <Input
                id="new_entry_date"
                type="date"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRentAgainOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving || !newRoomId}>
                {isSaving ? "Mendaftarkan..." : "Daftarkan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}