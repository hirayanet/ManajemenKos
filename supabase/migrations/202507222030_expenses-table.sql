-- Migration: Buat tabel expenses untuk pencatatan pengeluaran bulanan kosan
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,        -- contoh: 'Listrik', 'Air', 'Internet', 'Gaji', dst
  amount numeric NOT NULL,       -- jumlah pengeluaran
  expense_date date NOT NULL,    -- tanggal pengeluaran
  description text,              -- keterangan tambahan
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Trigger untuk update updated_at otomatis
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
