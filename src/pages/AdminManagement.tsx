import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { PlusCircle, Edit, Trash2, KeyRound, Shield, MoreVertical, Mail, CalendarDays } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import bcrypt from "bcryptjs";

interface Admin {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export default function AdminManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

  // Current logged-in admin
  const currentAdmin = JSON.parse(
    localStorage.getItem("admin_session") || "{}"
  );

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Gagal memuat data admin",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  const handleAddAdmin = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: "Form tidak lengkap",
        description: "Semua field harus diisi",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const passwordHash = bcrypt.hashSync(formData.password, 10);
      const { error } = await supabase.from("admins").insert({
        name: formData.name,
        email: formData.email,
        password_hash: passwordHash,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Email sudah digunakan oleh admin lain");
        }
        throw error;
      }

      toast({
        title: "Admin berhasil ditambahkan",
        description: `Admin "${formData.name}" telah dibuat`,
      });
      setIsDialogOpen(false);
      setFormData({ name: "", email: "", password: "" });
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Gagal menambahkan admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAdmin = async () => {
    if (!selectedAdmin || !formData.name || !formData.email) {
      toast({
        title: "Form tidak lengkap",
        description: "Nama dan email harus diisi",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData: Record<string, string> = {
        name: formData.name,
        email: formData.email,
      };

      // Only update password if provided
      if (formData.password) {
        updateData.password_hash = bcrypt.hashSync(formData.password, 10);
      }

      const { error } = await supabase
        .from("admins")
        .update(updateData)
        .eq("id", selectedAdmin.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("Email sudah digunakan oleh admin lain");
        }
        throw error;
      }

      toast({
        title: "Admin berhasil diupdate",
        description: `Data admin "${formData.name}" telah diperbarui`,
      });
      setIsDialogOpen(false);
      setSelectedAdmin(null);
      setFormData({ name: "", email: "", password: "" });
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Gagal mengupdate admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedAdmin) return;

    if (!passwordData.password) {
      toast({
        title: "Password tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      toast({
        title: "Password tidak cocok",
        description: "Konfirmasi password harus sama dengan password baru",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const passwordHash = bcrypt.hashSync(passwordData.password, 10);
      const { error } = await supabase
        .from("admins")
        .update({ password_hash: passwordHash })
        .eq("id", selectedAdmin.id);

      if (error) throw error;

      toast({
        title: "Password berhasil direset",
        description: `Password admin "${selectedAdmin.name}" telah diubah`,
      });
      setIsPasswordDialogOpen(false);
      setSelectedAdmin(null);
      setPasswordData({ password: "", confirmPassword: "" });
    } catch (error: any) {
      toast({
        title: "Gagal mereset password",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    if (selectedAdmin.id === currentAdmin.id) {
      toast({
        title: "Tidak bisa menghapus",
        description: "Anda tidak bisa menghapus akun sendiri",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("id", selectedAdmin.id);

      if (error) throw error;

      toast({
        title: "Admin berhasil dihapus",
        description: `Admin "${selectedAdmin.name}" telah dihapus`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Gagal menghapus admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: "",
    });
    setIsDialogOpen(true);
  };

  const openPasswordDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setPasswordData({ password: "", confirmPassword: "" });
    setIsPasswordDialogOpen(true);
  };

  const openDeleteDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manajemen Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola akun admin yang dapat mengakses sistem
          </p>
        </div>
        <Button className="w-full sm:w-auto shrink-0" onClick={() => {
          setSelectedAdmin(null);
          setFormData({ name: "", email: "", password: "" });
          setIsDialogOpen(true);
        }}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Tambah Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Daftar Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada admin terdaftar
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="block md:hidden space-y-3">
                {admins.map((admin) => {
                  const isYou = admin.id === currentAdmin.id;
                  return (
                    <div key={admin.id} className="rounded-xl border border-muted p-3 bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <InitialsAvatar name={admin.name} seed={admin.email} className="h-10 w-10 text-sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-base font-semibold">{admin.name}</span>
                            {isYou && (
                              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {admin.email}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {isYou ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <Shield className="h-3 w-3" /> Aktif (Anda)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            <Shield className="h-3 w-3" /> Admin
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(admin.created_at), "d MMM yyyy", { locale: localeId })}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 border-t border-dashed pt-3">
                        <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => openEditDialog(admin)}>
                          <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 rounded-full bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:text-amber-700" onClick={() => openPasswordDialog(admin)}>
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset
                        </Button>
                        {!isYou && (
                          <Button variant="outline" size="sm" className="flex-1 rounded-full bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:text-destructive" onClick={() => openDeleteDialog(admin)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/tablet table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[260px]">Admin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((admin) => {
                      const isYou = admin.id === currentAdmin.id;
                      return (
                        <TableRow key={admin.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <InitialsAvatar name={admin.name} seed={admin.email} className="h-9 w-9 text-xs" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{admin.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{admin.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isYou ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                                <Shield className="h-3 w-3" /> Aktif (Anda)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 whitespace-nowrap">
                                <Shield className="h-3 w-3" /> Admin
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(admin.created_at), "d MMM yyyy", { locale: localeId })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-primary/20 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-white"
                                    title="Aksi admin"
                                    aria-label="Aksi admin"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => openEditDialog(admin)}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit Data
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openPasswordDialog(admin)}>
                                    <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                  {!isYou && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openDeleteDialog(admin)}>
                                        <Trash2 className="h-4 w-4 mr-2" /> Hapus Admin
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedAdmin(null);
            setFormData({ name: "", email: "", password: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAdmin ? "Edit Admin" : "Tambah Admin Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Nama</Label>
              <Input
                id="admin-name"
                placeholder="Nama admin"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">
                {selectedAdmin ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder={
                  selectedAdmin
                    ? "Kosongkan jika tidak ingin mengubah"
                    : "Masukkan password"
                }
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
            <Button
              className="w-full"
              onClick={selectedAdmin ? handleEditAdmin : handleAddAdmin}
              disabled={isLoading}
            >
              {isLoading
                ? "Menyimpan..."
                : selectedAdmin
                  ? "Simpan Perubahan"
                  : "Tambah Admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            setSelectedAdmin(null);
            setPasswordData({ password: "", confirmPassword: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reset Password — {selectedAdmin?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Masukkan password baru"
                value={passwordData.password}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Ulangi password baru"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })
                }
              />
            </div>
            <Button
              className="w-full"
              onClick={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? "Menyimpan..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah kamu yakin ingin menghapus admin "{selectedAdmin?.name}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
