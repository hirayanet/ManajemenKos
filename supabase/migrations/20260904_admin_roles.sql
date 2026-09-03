-- Peran aplikasi:
--   'pemilik'   → Pemilik/Admin: akses semua menu (termasuk Manajemen Admin & Pengaturan)
--   'pengelola' → Pengelola: tidak bisa akses Manajemen Admin & Pengaturan
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'pengelola';

-- Semua admin yang sudah ada dianggap Pemilik (jangan sampai kehilangan akses).
UPDATE public.admins SET role = 'pemilik' WHERE role = 'pengelola';

-- Guard nilai kolom (aman dijalankan ulang).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check') THEN
    ALTER TABLE public.admins ADD CONSTRAINT admins_role_check CHECK (role IN ('pemilik', 'pengelola'));
  END IF;
END
$$;
