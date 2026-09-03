-- Redesain penyimpanan pembayaran harian:
-- 1. Tambah kolom periode_mulai & periode_selesai (DATE) di tabel payments.
--    Kolom ini hanya diisi untuk pembayaran harian; pembayaran bulanan tetap
--    memakai payment_month (nama bulan) + payment_date (tahun) seperti sekarang.
-- 2. Isi kolom baru dari teks periode lama yang tersimpan di payment_month,
--    format: "Harian: 1 Agustus 2026 - 3 Agustus 2026".

ALTER TABLE public.payments
  ADD COLUMN periode_mulai DATE,
  ADD COLUMN periode_selesai DATE;

COMMENT ON COLUMN public.payments.periode_mulai IS 'Tanggal awal periode sewa (khusus pembayaran harian)';
COMMENT ON COLUMN public.payments.periode_selesai IS 'Tanggal akhir periode sewa (khusus pembayaran harian)';

ALTER TABLE public.payments
  ADD CONSTRAINT payments_periode_check
  CHECK (periode_selesai IS NULL OR periode_mulai IS NULL OR periode_selesai >= periode_mulai);

CREATE INDEX payments_periode_mulai_idx ON public.payments (periode_mulai);

-- Helper sementara untuk mem-parse tanggal berbahasa Indonesia: "1 Agustus 2026"
CREATE OR REPLACE FUNCTION public._parse_tanggal_idi(t TEXT)
RETURNS DATE AS $$
DECLARE
  bulan_nama TEXT[] := ARRAY[
    'januari','februari','maret','april','mei','juni',
    'juli','agustus','september','oktober','november','desember'
  ];
  parts TEXT[];
  hari INT;
  bulan INT := 0;
  tahun INT;
  i INT;
BEGIN
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  parts := regexp_match(lower(trim(t)), '^(\d{1,2})\s+([a-z]+)\s+(\d{4})$');
  IF parts IS NULL THEN
    RETURN NULL;
  END IF;
  hari := parts[1]::INT;
  tahun := parts[3]::INT;
  FOR i IN 1..12 LOOP
    IF bulan_nama[i] = parts[2] THEN
      bulan := i;
      EXIT;
    END IF;
  END LOOP;
  IF bulan = 0 THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN make_date(tahun, bulan, hari);
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Isi periode_mulai & periode_selesai dari teks "Harian: <mulai> - <selesai>"
DO $$
DECLARE
  r RECORD;
  body TEXT;
  sisi TEXT[];
  tgl_mulai DATE;
  tgl_selesai DATE;
  terisi INT := 0;
  dilewati INT := 0;
BEGIN
  FOR r IN
    SELECT id, payment_month
    FROM public.payments
    WHERE payment_month LIKE 'Harian:%'
  LOOP
    body := trim(regexp_replace(r.payment_month, '^Harian:\s*', '', 'i'));
    sisi := regexp_split_to_array(body, '\s+-\s+');
    tgl_mulai := NULL;
    tgl_selesai := NULL;
    IF array_length(sisi, 1) = 2 THEN
      tgl_mulai := public._parse_tanggal_idi(sisi[1]);
      tgl_selesai := public._parse_tanggal_idi(sisi[2]);
    END IF;
    IF tgl_mulai IS NOT NULL AND tgl_selesai IS NOT NULL AND tgl_selesai >= tgl_mulai THEN
      UPDATE public.payments
      SET periode_mulai = tgl_mulai, periode_selesai = tgl_selesai
      WHERE id = r.id;
      terisi := terisi + 1;
    ELSE
      dilewati := dilewati + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Periode harian terisi: % baris, dilewati (tidak bisa diparse): % baris', terisi, dilewati;
END $$;

DROP FUNCTION public._parse_tanggal_idi(TEXT);
