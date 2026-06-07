-- Tabel untuk menyimpan data reservasi Down Payment (DP) calon penghuni kost
CREATE TABLE public.dp_reservasi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_calon TEXT NOT NULL,
  phone_number TEXT,
  room_id INTEGER NOT NULL REFERENCES public.rooms(id),
  harga_per_bulan DECIMAL(10,2) NOT NULL,
  nominal_dp DECIMAL(10,2) NOT NULL,
  tanggal_dp DATE NOT NULL,
  deadline_pelunasan DATE NOT NULL,
  nominal_pelunasan DECIMAL(10,2) GENERATED ALWAYS AS (harga_per_bulan - nominal_dp) STORED,
  tanggal_pelunasan DATE,
  payment_method_dp TEXT NOT NULL DEFAULT 'Tunai',
  payment_method_pelunasan TEXT,
  status TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Lunas', 'Hangus')),
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  receipt_url_dp TEXT,
  receipt_url_pelunasan TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.dp_reservasi ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON public.dp_reservasi
  FOR ALL USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_dp_reservasi_updated_at
  BEFORE UPDATE ON public.dp_reservasi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index untuk performa
CREATE INDEX idx_dp_reservasi_status ON public.dp_reservasi(status);
CREATE INDEX idx_dp_reservasi_room_id ON public.dp_reservasi(room_id);
CREATE INDEX idx_dp_reservasi_deadline ON public.dp_reservasi(deadline_pelunasan);
