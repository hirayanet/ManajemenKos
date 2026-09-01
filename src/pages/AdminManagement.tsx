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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Edit, Trash2, KeyRound, Shield } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Admin</h1>
          <p className="text-muted-foreground">
            Kelola akun admin yang dapat mengakses sistem
          </p>
        </div>
        <Button onClick={() => {
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      {admin.id === currentAdmin.id ? (
                        <Badge variant="default">Aktif (Anda)</Badge>
                      ) : (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(admin.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(admin)}
                          title="Edit admin"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPasswordDialog(admin)}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {admin.id !== currentAdmin.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(admin)}
                            title="Hapus admin"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
