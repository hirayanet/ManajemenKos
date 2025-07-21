-- Tambahkan kolom status_penghuni dan tanggal_keluar ke tabel residents
ALTER TABLE public.residents 
ADD COLUMN status_penghuni text CHECK (status_penghuni IN ('Aktif', 'Sudah Keluar')) DEFAULT 'Aktif',
ADD COLUMN tanggal_keluar date;

-- Update trigger untuk menangani status kamar saat penghuni keluar
CREATE OR REPLACE FUNCTION update_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  -- Update room status based on active residents
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Jika penghuni aktif, set kamar menjadi terisi
    IF NEW.status_penghuni = 'Aktif' THEN
      UPDATE public.rooms 
      SET is_occupied = true 
      WHERE id = NEW.room_id;
    -- Jika penghuni sudah keluar, periksa apakah masih ada penghuni aktif di kamar tersebut
    ELSIF NEW.status_penghuni = 'Sudah Keluar' THEN
      -- Hitung jumlah penghuni aktif di kamar tersebut
      IF (SELECT COUNT(*) FROM public.residents WHERE room_id = NEW.room_id AND status_penghuni = 'Aktif') = 0 THEN
        -- Jika tidak ada penghuni aktif, set kamar menjadi kosong
        UPDATE public.rooms 
        SET is_occupied = false 
        WHERE id = NEW.room_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Jika penghuni dihapus, periksa apakah masih ada penghuni aktif di kamar tersebut
    IF (SELECT COUNT(*) FROM public.residents WHERE room_id = OLD.room_id AND status_penghuni = 'Aktif') = 0 THEN
      -- Jika tidak ada penghuni aktif, set kamar menjadi kosong
      UPDATE public.rooms 
      SET is_occupied = false 
      WHERE id = OLD.room_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;