import { Navigate } from "react-router-dom";
import { isOwner } from "@/lib/roles";

/**
 * Pembungkus rute khusus Pemilik/Admin. Pengelola yang membuka
 * Manajemen Admin / Pengaturan langsung dialihkan ke Dashboard.
 */
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  if (!isOwner()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
