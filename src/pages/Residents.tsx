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
  marital_status: string;
  marriage_document_url?: string;
  created_at: string;
  rooms: { room_number: number };
  status_penghuni?: string; // opsional agar tidak error jika field kosong
  tanggal_keluar?: string; // opsional
}

export default function Residents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"Aktif" | "Sudah Keluar" | "Semua">("Aktif");
  const [editMode, setEditMode] = useState<"single" | "multi">("single");
  interface FormDataType {
    full_name: string;
    phone_number: string;
    room_id: string;
    entry_date: string;
    is_active: boolean;
    marital_status: string;
    status_penghuni: string;
    tanggal_keluar: string;
    ktp_file?: File | null;
    marriage_file?: File | null;
    ktp_image_url?: string;
    marriage_document_url?: string;
  }

  const [formData, setFormData] = useState<FormDataType>({
    full_name: "",
    phone_number: "",
    room_id: "",
    entry_date: "",
    is_active: true,
    marital_status: "Lajang",
    status_penghuni: "Aktif",
    tanggal_keluar: "",
    ktp_file: null,
    marriage_file: null,
    ktp_image_url: undefined,
    marriage_document_url: undefined,
  });

  interface FormResidentType {
    full_name: string;
    phone_number: string;
    entry_date: string;
    ktp_file?: File | null;
    marital_status: string;
    marriage_file?: File | null;
    ktp_image_url?: string;
    marriage_document_url?: string;
  }

  const { toast } = useToast();

  // Tambahan: Map roomId -> jumlah penghuni aktif
  const [roomOccupancy, setRoomOccupancy] = useState<{ [roomId: number]: number }>({});
  // State form multi penghuni
  const [formResidents, setFormResidents] = useState<FormResidentType[]>([
    { full_name: "", phone_number: "", entry_date: "", ktp_file: null as File | null, marital_status: "Lajang", ktp_image_url: undefined, marriage_file: null as File | null, marriage_document_url: undefined },
    { full_name: "", phone_number: "", entry_date: "", ktp_file: null as File | null, marital_status: "Lajang", ktp_image_url: undefined, marriage_file: null as File | null, marriage_document_url: undefined },
  ]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [maxSlot, setMaxSlot] = useState(1); // kapasitas kamar
  const [availableSlot, setAvailableSlot] = useState(1); // sisa slot kamar

  useEffect(() => {
    fetchResidents();
    fetchRooms();
  }, []);

  const fetchResidents = async () => {
    try {
      let query = supabase
        .from("residents")
        .select(`*, rooms (room_number)`);
      
      // Filter berdasarkan status
      if (statusFilter !== "Semua") {
        query = query.eq("status_penghuni", statusFilter);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
  
      if (error) throw error;
      // Pastikan status_penghuni ada (default "Aktif")
      const residentsWithStatus = (data || []).map((r: Resident) => ({
        ...r,
        status_penghuni: r.status_penghuni || "Aktif",
      }));
      setResidents(residentsWithStatus);
      // Hitung occupancy
      const occ: { [roomId: number]: number } = {};
      residentsWithStatus.forEach((r: Resident) => {
        if (r.status_penghuni === "Aktif") {
          occ[r.room_id] = (occ[r.room_id] || 0) + 1;
        }
      });
      setRoomOccupancy(occ);
    } catch (error) {
      toast({ title: "Error", description: "Gagal memuat data penghuni", variant: "destructive" });
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
    try {
      const { error: uploadError } = await supabase.storage
        .from('ktp-images')
        .upload(filePath, file, {
          upsert: true
        });
      if (uploadError) {
        toast({
          title: "Gagal Upload KTP",
          description: "Terjadi kesalahan saat mengupload file KTP. Silakan coba lagi.",
          variant: "destructive",
        });
        throw uploadError;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('ktp-images')
        .getPublicUrl(filePath);
      toast({
        title: "Upload KTP Berhasil",
        description: "File KTP berhasil diupload.",
      });
      return publicUrl;
    } catch (err) {
      // fallback jika error lain
      toast({
        title: "Gagal Upload KTP",
        description: "Terjadi kesalahan saat mengupload file KTP.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const uploadMarriageDocument = async (file: File, residentId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `marriage_${residentId}.${fileExt}`;
    const filePath = `marriage/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('ktp-images')
        .upload(filePath, file, {
          upsert: true
        });
      if (uploadError) {
        toast({
          title: "Gagal Upload Dokumen Nikah",
          description: "Terjadi kesalahan saat mengupload file dokumen nikah. Silakan coba lagi.",
          variant: "destructive",
        });
        throw uploadError;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('ktp-images')
        .getPublicUrl(filePath);
      toast({
        title: "Upload Dokumen Nikah Berhasil",
        description: "File dokumen nikah berhasil diupload.",
      });
      return publicUrl;
    } catch (err) {
      toast({
        title: "Gagal Upload Dokumen Nikah",
        description: "Terjadi kesalahan saat mengupload file dokumen nikah.",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Reset form
  const resetForm = () => {
    setFormResidents([
      { full_name: "", phone_number: "", entry_date: "", ktp_file: null, marital_status: "Lajang" },
      { full_name: "", phone_number: "", entry_date: "", ktp_file: null, marital_status: "Lajang" },
    ]);
    setSelectedRoomId("");
    setMaxSlot(1);
    setAvailableSlot(1);
    setSelectedResident(null);
  };

  // Saat memilih kamar, tentukan kapasitas dan slot kosong
  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find(r => r.id.toString() === roomId);
    if (!room) return;
    const rn = room.room_number;
    const max = rn >= 7 && rn <= 15 ? 2 : 1;
    setMaxSlot(max);
    const occ = roomOccupancy[room.id] || 0;
    const available = Math.max(0, max - occ);
    setAvailableSlot(available);
    // Reset blok input sesuai slot
    setFormResidents(Array(available).fill(null).map(() => ({ full_name: "", phone_number: "", entry_date: "", ktp_file: null, marital_status: "Lajang" })));
  };

  // Handle input perubahan data penghuni
  const handleFormResidentChange = (idx: number, field: string, value: any) => {
    setFormResidents(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Handle submit multi penghuni
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Validasi minimal 1 blok terisi
      const filled = formResidents.filter(r => r.full_name && r.phone_number && r.entry_date);
      if (filled.length === 0) {
        toast({ title: "Error", description: "Minimal 1 penghuni harus diisi", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      // Simpan semua blok yang terisi
      for (let i = 0; i < filled.length; i++) {
        const r = filled[i];
        const { data: newResident, error } = await supabase
          .from("residents")
          .insert({
            full_name: r.full_name,
            phone_number: r.phone_number,
            room_id: parseInt(selectedRoomId),
            entry_date: r.entry_date,
            is_active: true,
            marital_status: r.marital_status,
            status_penghuni: "Aktif",
          })
          .select()
          .single();
        if (error) throw error;
        // Upload KTP jika ada
        if (r.ktp_file && newResident) {
          const imageUrl = await uploadKtpImage(r.ktp_file, newResident.id);
          await supabase.from("residents").update({ ktp_image_url: imageUrl }).eq("id", newResident.id);
        }
      }
      toast({ title: "Berhasil", description: `${filled.length} penghuni berhasil ditambahkan` });
      setIsDialogOpen(false);
      resetForm();
      fetchResidents();
    } catch (error) {
      toast({ title: "Error", description: "Terjadi kesalahan saat menyimpan data", variant: "destructive" });
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

  const openEditDialog = (resident: Resident) => {
    setSelectedResident(resident);
    // Cek nomor kamar
    const roomNumber = resident.rooms?.room_number || 0;
    if (roomNumber >= 1 && roomNumber <= 6) {
      setEditMode("single");
      setFormData({
        full_name: resident.full_name,
        phone_number: resident.phone_number,
        room_id: resident.room_id.toString(),
        entry_date: resident.entry_date,
        is_active: resident.is_active,
        marital_status: resident.marital_status || "Lajang",
        status_penghuni: resident.status_penghuni || "Aktif",
        tanggal_keluar: resident.tanggal_keluar || "",
      });
    } else if (roomNumber >= 7 && roomNumber <= 15) {
      setEditMode("multi");
      // Ambil semua penghuni di kamar tersebut
      const penghuniKamar = residents.filter(r => r.room_id === resident.room_id);
      // Jika penghuni < 2, tambahkan blok kosong untuk slot yang masih tersedia
      const blocks = [...penghuniKamar.map(r => ({
        full_name: r.full_name,
        phone_number: r.phone_number,
        entry_date: r.entry_date,
        ktp_file: null,
        marital_status: r.marital_status || "Lajang",
        ktp_image_url: r.ktp_image_url,
        marriage_file: null,
        marriage_document_url: r.marriage_document_url,
      }))];
      if (blocks.length < 2) {
        blocks.push({
          full_name: "",
          phone_number: "",
          entry_date: "",
          ktp_file: null,
          marital_status: "Lajang",
          ktp_image_url: undefined,
          marriage_file: null,
          marriage_document_url: undefined,
        });
      }
      setFormResidents(blocks);
      setSelectedRoomId(resident.room_id.toString());
      setMaxSlot(2);
    }
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Tambahkan fungsi handleMarkAsLeft di sini
  const handleMarkAsLeft = async (resident: Resident) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from("residents")
        .update({
          status_penghuni: "Sudah Keluar",
          tanggal_keluar: today,
          is_active: false, // Tetap update is_active untuk kompatibilitas
        })
        .eq("id", resident.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `${resident.full_name} telah ditandai sudah keluar`,
      });
      
      fetchResidents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menandai penghuni keluar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Data Penghuni</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              Tambah Penghuni
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>{selectedResident ? "Edit Penghuni" : "Tambah Penghuni Baru"}</DialogTitle>
            </DialogHeader>
            {selectedResident ? (
              editMode === "single" ? (
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    setIsLoading(true);
                    try {
                      // Upload KTP jika ada file baru
                      let ktpUrl = formData.ktp_image_url;
                      if (formData.ktp_file) {
                        ktpUrl = await uploadKtpImage(formData.ktp_file, selectedResident.id);
                      }
                      // Upload dokumen nikah jika ada file baru
                      let marriageUrl = formData.marriage_document_url;
                      if (formData.marital_status === "Menikah" && formData.marriage_file) {
                        marriageUrl = await uploadMarriageDocument(formData.marriage_file, selectedResident.id);
                      }
                      const { error } = await supabase
                        .from("residents")
                        .update({
                          full_name: formData.full_name,
                          phone_number: formData.phone_number,
                          entry_date: formData.entry_date,
                          marital_status: formData.marital_status,
                          status_penghuni: formData.status_penghuni,
                          tanggal_keluar: formData.tanggal_keluar,
                          is_active: formData.status_penghuni === "Aktif",
                          ktp_image_url: ktpUrl,
                          marriage_document_url: marriageUrl,
                        })
                        .eq("id", selectedResident.id);
                      if (error) throw error;
                      toast({ title: "Berhasil", description: "Data penghuni berhasil diupdate" });
                      setIsDialogOpen(false);
                      fetchResidents();
                    } catch (error) {
                      toast({ title: "Error", description: "Gagal update data", variant: "destructive" });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Nama Lengkap</Label>
                    <Input value={formData.full_name} onChange={e => setFormData(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>No. Telepon</Label>
                    <Input value={formData.phone_number} onChange={e => setFormData(f => ({ ...f, phone_number: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Masuk</Label>
                    <Input type="date" value={formData.entry_date} onChange={e => setFormData(f => ({ ...f, entry_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Status Pernikahan</Label>
                    <Select value={formData.marital_status} onValueChange={val => setFormData(f => ({ ...f, marital_status: val }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status pernikahan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lajang">Lajang</SelectItem>
                        <SelectItem value="Menikah">Menikah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Upload KTP</Label>
                    <Input type="file" accept="image/*,.pdf" onChange={e => setFormData(f => ({ ...f, ktp_file: e.target.files?.[0] || null }))} />
                    {formData.ktp_image_url && (
                      <a href={formData.ktp_image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Lihat KTP yang sudah diupload</a>
                    )}
                  </div>
                  {formData.marital_status === "Menikah" && (
                    <div className="space-y-2">
                      <Label>Upload Dokumen Nikah</Label>
                      <Input type="file" accept="image/*,.pdf" onChange={e => setFormData(f => ({ ...f, marriage_file: e.target.files?.[0] || null }))} />
                      {formData.marriage_document_url && (
                        <a href={formData.marriage_document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Lihat dokumen nikah yang sudah diupload</a>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Status Penghuni</Label>
                    <Select value={formData.status_penghuni} onValueChange={val => setFormData(f => ({ ...f, status_penghuni: val }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktif">Aktif</SelectItem>
                        <SelectItem value="Sudah Keluar">Sudah Keluar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.status_penghuni === "Sudah Keluar" && (
                    <div className="space-y-2">
                      <Label>Tanggal Keluar</Label>
                      <Input type="date" value={formData.tanggal_keluar} onChange={e => setFormData(f => ({ ...f, tanggal_keluar: e.target.value }))} />
                    </div>
                  )}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </form>
              ) : (
                // Multi edit mode
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    setIsLoading(true);
                    try {
                      // Ambil penghuni kamar dari database (urutan sama dengan formResidents kecuali blok kosong di akhir)
                      const penghuniKamar = residents.filter(res => res.room_id.toString() === selectedRoomId);
                      for (let i = 0; i < formResidents.length; i++) {
                        const r = formResidents[i];
                        // Jika blok ke-i sudah ada penghuni, lakukan update
                        if (i < penghuniKamar.length) {
                          const residentToUpdate = penghuniKamar[i];
                          // Upload KTP jika ada file baru
                          let ktpUrl = residentToUpdate.ktp_image_url;
                          if (r.ktp_file) {
                            ktpUrl = await uploadKtpImage(r.ktp_file, residentToUpdate.id);
                          }
                          // Upload dokumen nikah jika ada file baru
                          let marriageUrl = residentToUpdate.marriage_document_url;
                          if (r.marital_status === "Menikah" && r.marriage_file) {
                            marriageUrl = await uploadMarriageDocument(r.marriage_file, residentToUpdate.id);
                          }
                          const { error } = await supabase
                            .from("residents")
                            .update({
                              full_name: r.full_name,
                              phone_number: r.phone_number,
                              entry_date: r.entry_date,
                              marital_status: r.marital_status,
                              ktp_image_url: ktpUrl,
                              marriage_document_url: marriageUrl,
                            })
                            .eq("id", residentToUpdate.id);
                          if (error) throw error;
                        } else {
                          // Jika blok ke-i adalah blok kosong dan diisi, lakukan insert
                          if (r.full_name && r.phone_number && r.entry_date) {
                            // Upload KTP jika ada file
                            let ktpUrl = undefined;
                            if (r.ktp_file) {
                              ktpUrl = await uploadKtpImage(r.ktp_file, `new_${Date.now()}_${i}`);
                            }
                            // Upload dokumen nikah jika ada file
                            let marriageUrl = undefined;
                            if (r.marital_status === "Menikah" && r.marriage_file) {
                              marriageUrl = await uploadMarriageDocument(r.marriage_file, `new_${Date.now()}_${i}`);
                            }
                            const { error } = await supabase
                              .from("residents")
                              .insert({
                                full_name: r.full_name,
                                phone_number: r.phone_number,
                                room_id: parseInt(selectedRoomId),
                                entry_date: r.entry_date,
                                is_active: true,
                                marital_status: r.marital_status,
                                status_penghuni: "Aktif",
                                ktp_image_url: ktpUrl,
                                marriage_document_url: marriageUrl,
                              });
                            if (error) throw error;
                          }
                        }
                      }
                      toast({ title: "Berhasil", description: "Data penghuni kamar berhasil diupdate/tambah" });
                      setIsDialogOpen(false);
                      fetchResidents();
                    } catch (error) {
                      toast({ title: "Error", description: "Gagal update/tambah data", variant: "destructive" });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="space-y-4"
                >
                  {formResidents.map((fr, idx) => (
                    <div key={idx} className="border rounded p-4 mb-2">
                      <div className="font-semibold mb-2">Penghuni {idx + 1}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nama Lengkap</Label>
                          <Input value={fr.full_name} onChange={e => handleFormResidentChange(idx, "full_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>No. Telepon</Label>
                          <Input value={fr.phone_number} onChange={e => handleFormResidentChange(idx, "phone_number", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                          <Label>Tanggal Masuk</Label>
                          <Input type="date" value={fr.entry_date} onChange={e => handleFormResidentChange(idx, "entry_date", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Status Pernikahan</Label>
                          <Select value={fr.marital_status} onValueChange={val => handleFormResidentChange(idx, "marital_status", val)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih status pernikahan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Lajang">Lajang</SelectItem>
                              <SelectItem value="Menikah">Menikah</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2 mt-2">
                        <Label>Upload KTP</Label>
                        <Input type="file" accept="image/*,.pdf" onChange={e => handleFormResidentChange(idx, "ktp_file", e.target.files?.[0] || null)} />
                        {fr.ktp_image_url && (
                          <a href={fr.ktp_image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Lihat KTP yang sudah diupload</a>
                        )}
                      </div>
                      {fr.marital_status === "Menikah" && (
                        <div className="space-y-2 mt-2">
                          <Label>Upload Dokumen Nikah</Label>
                          <Input type="file" accept="image/*,.pdf" onChange={e => handleFormResidentChange(idx, "marriage_file", e.target.files?.[0] || null)} />
                          {fr.marriage_document_url && (
                            <a href={fr.marriage_document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Lihat dokumen nikah yang sudah diupload</a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </form>
              )
            ) : (
              // ADD dialog (default)
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room_id">Kamar</Label>
                  <Select value={selectedRoomId} onValueChange={handleRoomChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kamar" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.filter(room => {
                      // Hanya tampilkan kamar yang benar-benar kosong
                      const occ = roomOccupancy[room.id] || 0;
                      return occ === 0;
                    }).map(room => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        Kamar {room.room_number}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
                {availableSlot === 0 && (
                  <div className="text-red-500">Kamar sudah penuh, silakan pilih kamar lain.</div>
                )}
                {Array.from({ length: availableSlot }).map((_, idx) => (
                  <div key={idx} className="border rounded p-4 mb-2">
                    <div className="font-semibold mb-2">Penghuni {idx + 1} {idx === 1 ? "(Opsional)" : ""}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nama Lengkap</Label>
                        <Input value={formResidents[idx]?.full_name || ""} onChange={e => handleFormResidentChange(idx, "full_name", e.target.value)} required={idx === 0} />
                      </div>
                      <div className="space-y-2">
                        <Label>No. Telepon</Label>
                        <Input value={formResidents[idx]?.phone_number || ""} onChange={e => handleFormResidentChange(idx, "phone_number", e.target.value)} required={idx === 0} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label>Tanggal Masuk</Label>
                        <Input type="date" value={formResidents[idx]?.entry_date || ""} onChange={e => handleFormResidentChange(idx, "entry_date", e.target.value)} required={idx === 0} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status Pernikahan</Label>
                        <Select value={formResidents[idx]?.marital_status || "Lajang"} onValueChange={val => handleFormResidentChange(idx, "marital_status", val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih status pernikahan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lajang">Lajang</SelectItem>
                            <SelectItem value="Menikah">Menikah</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <Label>Upload KTP</Label>
                      <Input type="file" accept="image/*" onChange={e => handleFormResidentChange(idx, "ktp_file", e.target.files?.[0] || null)} />
                    </div>
                  </div>
                ))}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={isLoading || availableSlot === 0}>
                    {isLoading ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daftar Penghuni</CardTitle>
          <div className="flex space-x-2">
            <Select value={statusFilter} onValueChange={(value: "Aktif" | "Sudah Keluar" | "Semua") => {
              setStatusFilter(value);
              fetchResidents();
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aktif">Penghuni Aktif</SelectItem>
                <SelectItem value="Sudah Keluar">Sudah Keluar</SelectItem>
                <SelectItem value="Semua">Semua Penghuni</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>No. Telepon</TableHead>
                <TableHead>Kamar</TableHead>
                <TableHead>Tanggal Masuk</TableHead>
                <TableHead>Status Pernikahan</TableHead>
                <TableHead>Status</TableHead>
                {statusFilter === "Sudah Keluar" && <TableHead>Tanggal Keluar</TableHead>}
                <TableHead>KTP</TableHead>
                <TableHead>Dokumen</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents
                .slice()
                .sort((a, b) => (a.rooms.room_number || 0) - (b.rooms.room_number || 0))
                .map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell className="font-medium">{resident.full_name}</TableCell>
                    <TableCell>{resident.phone_number}</TableCell>
                    <TableCell>Kamar {resident.rooms.room_number}</TableCell>
                    <TableCell>{format(new Date(resident.entry_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={resident.marital_status === 'Menikah' ? "default" : "secondary"}>
                        {resident.marital_status || "Lajang"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {resident.status_penghuni || "Aktif"}
                    </Badge>
                  </TableCell>
                  {statusFilter === "Sudah Keluar" && (
                    <TableCell>
                      {resident.tanggal_keluar ? format(new Date(resident.tanggal_keluar), "dd/MM/yyyy") : "-"}
                    </TableCell>
                  )}
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
                    {resident.marriage_document_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(resident.marriage_document_url, '_blank')}
                      >
                        <Upload className="h-4 w-4" />
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
                      
                      {resident.status_penghuni === "Aktif" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:text-amber-700">
                              <User className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Tandai Sudah Keluar</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menandai {resident.full_name} sebagai sudah keluar?
                                Tindakan ini akan mengubah status kamar menjadi kosong jika tidak ada penghuni aktif lainnya.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleMarkAsLeft(resident)}>
                                Tandai Sudah Keluar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      
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