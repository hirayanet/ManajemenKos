/**
 * Peran aplikasi:
 * - "pemilik"   → Pemilik/Admin: akses semua menu.
 * - "pengelola" → Pengelola: menu Manajemen Admin & Pengaturan disembunyikan.
 * Session lama tanpa kolom role dianggap pemilik (agar tidak kehilangan akses).
 */

export type AdminRole = "pemilik" | "pengelola";

export interface AdminSession {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export function getAdminSession(): AdminSession {
  try {
    return JSON.parse(localStorage.getItem("admin_session") || "{}") as AdminSession;
  } catch {
    return {};
  }
}

export function getAdminRole(): AdminRole {
  const session = getAdminSession();
  return session.role === "pengelola" ? "pengelola" : "pemilik";
}

/** Hanya Pemilik/Admin yang boleh membuka Manajemen Admin & Pengaturan. */
export function isOwner(): boolean {
  return getAdminRole() === "pemilik";
}
