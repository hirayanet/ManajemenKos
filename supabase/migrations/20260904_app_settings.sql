-- Pengaturan bisnis / branding (satu baris, id = 1).
-- Dipakai untuk kwitansi PDF & struk: nama, kontak, logo, tanda tangan digital,
-- dan teks label per jenis kwitansi.
CREATE TABLE public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'HIRAYA KOST',
  tagline text NOT NULL DEFAULT 'Manajemen Kos & Pembayaran',
  address text NOT NULL DEFAULT 'Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong',
  phone text NOT NULL DEFAULT '087722667913',
  logo_url text,
  signature_url text,
  labels jsonb NOT NULL DEFAULT '{
    "payment":   { "title": "KWITANSI PEMBAYARAN",   "subtitle": "Bukti pembayaran sewa kamar kos",                      "footer": "Terima kasih telah membayar tepat waktu." },
    "dp":        { "title": "KWITANSI DOWN PAYMENT", "subtitle": "Pembayaran DP reservasi kamar kos",                     "footer": "DP yang hangus tidak dapat dikembalikan." },
    "pelunasan": { "title": "KWITANSI PELUNASAN",    "subtitle": "Pelunasan sewa — penghuni baru setelah DP",            "footer": "Terima kasih telah membayar tepat waktu." }
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Baris default langsung dibuat agar aplikasi tinggal membaca.
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS mengikuti pola tabel lain di aplikasi ini.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.app_settings
  FOR ALL USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket penyimpanan untuk logo & tanda tangan digital
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow all access to branding assets" ON storage.objects
  FOR ALL USING (bucket_id = 'branding');
