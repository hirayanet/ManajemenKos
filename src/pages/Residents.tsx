import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Edit, Trash2, Upload, User } from "lucide-react";
import { format } from "date-fns";

interface Room {
  id: number;
  room_number: number;
  is_occupied: boolean;
}

interface Resident {
  id: string;
  full_name: string;
  phone_number: string;
  room_id: number;
  entry_date: string;
  is_active: boolean;
  ktp_image_url?: string;
  created_at: string;
  rooms: { room_number: number };
}

export default function Residents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    room_id: "",
    entry_date: "",
    is_active: true,
  });

  useEffect(() => {
    fetchResidents();
    fetchRooms();
  }, []);

  const fetchResidents = async () => {
    try {
      const { data, error } = await supabase
        .from("residents")
        .select(`
          *,
          rooms (room_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResidents(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data penghuni",
        variant: "destructive",
      });
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("room_number");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data kamar",
        variant: "destructive",
      });
    }
  };

  const uploadKtpImage = async (file: File, residentId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${residentId}.${fileExt}`;
    const filePath = `ktp/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ktp-images')
      .upload(filePath, file, {
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('ktp-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (selectedResident) {
        // Update resident
        const { error } = await supabase
          .from("residents")
          .update({
            full_name: formData.full_name,
            phone_number: formData.phone_number,
            room_id: parseInt(formData.room_id),
            entry_date: formData.entry_date,
            is_active: formData.is_active,
          })
          .eq("id", selectedResident.id);

        if (error) throw error;

        // Upload KTP if file selected
        if (ktpFile) {
          const imageUrl = await uploadKtpImage(ktpFile, selectedResident.id);
          await supabase
            .from("residents")
            .update({ ktp_image_url: imageUrl })
            .eq("id", selectedResident.id);
        }

        toast({
          title: "Berhasil",
          description: "Data penghuni berhasil diperbarui",
        });
      } else {
        // Create new resident
        const { data: newResident, error } = await supabase
          .from("residents")
          .insert({
            full_name: formData.full_name,
            phone_number: formData.phone_number,
            room_id: parseInt(formData.room_id),
            entry_date: formData.entry_date,
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) throw error;

        // Upload KTP if file selected
        if (ktpFile && newResident) {
          const imageUrl = await uploadKtpImage(ktpFile, newResident.id);
          await supabase
            .from("residents")
            .update({ ktp_image_url: imageUrl })
            .eq("id", newResident.id);
        }

        toast({
          title: "Berhasil",
          description: "Penghuni baru berhasil ditambahkan",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchResidents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat menyimpan data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("residents")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Penghuni berhasil dihapus",
      });
      fetchResidents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus penghuni",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone_number: "",
      room_id: "",
      entry_date: "",
      is_active: true,
    });
    setSelectedResident(null);
    setKtpFile(null);
  };

  const openEditDialog = (resident: Resident) => {
    setSelectedResident(resident);
    setFormData({
      full_name: resident.full_name,
      phone_number: resident.phone_number,
      room_id: resident.room_id.toString(),
      entry_date: resident.entry_date,
      is_active: resident.is_active,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Data Penghuni</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              Tambah Penghuni
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {selectedResident ? "Edit Penghuni" : "Tambah Penghuni Baru"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">No. Telepon</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="room_id">Kamar</Label>
                  <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kamar" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms
                        .filter(room => !room.is_occupied || (selectedResident && room.id === selectedResident.room_id))
                        .map((room) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          Kamar {room.room_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry_date">Tanggal Masuk</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ktp_file">Upload KTP</Label>
                <Input
                  id="ktp_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setKtpFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active">Status Aktif</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Menyimpan..." : selectedResident ? "Perbarui" : "Simpan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Penghuni</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>No. Telepon</TableHead>
                <TableHead>Kamar</TableHead>
                <TableHead>Tanggal Masuk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KTP</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((resident) => (
                <TableRow key={resident.id}>
                  <TableCell className="font-medium">{resident.full_name}</TableCell>
                  <TableCell>{resident.phone_number}</TableCell>
                  <TableCell>Kamar {resident.rooms.room_number}</TableCell>
                  <TableCell>{format(new Date(resident.entry_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={resident.is_active ? "default" : "secondary"}>
                      {resident.is_active ? "Aktif" : "Tidak Aktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {resident.ktp_image_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(resident.ktp_image_url, '_blank')}
                      >
                        <User className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(resident)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Penghuni</AlertDialogTitle>
                            <AlertDialogDescription>
                              Apakah Anda yakin ingin menghapus {resident.full_name}? 
                              Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(resident.id)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}