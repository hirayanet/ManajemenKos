-- Allow multiple residents per room and fix occupancy logic
BEGIN;

-- Drop unique constraint on room_id to allow multiple residents per room (capacity > 1)
ALTER TABLE public.residents DROP CONSTRAINT IF EXISTS residents_room_id_key;

-- Update occupancy function to reflect any active residents in a room
CREATE OR REPLACE FUNCTION update_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update NEW room occupancy based on whether there exists any active resident in that room
    UPDATE public.rooms r
    SET is_occupied = EXISTS (
      SELECT 1 FROM public.residents res
      WHERE res.room_id = NEW.room_id AND res.is_active = true
    )
    WHERE r.id = NEW.room_id;

    -- If room_id changed in UPDATE, also update OLD room occupancy
    IF TG_OP = 'UPDATE' AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN
      UPDATE public.rooms r
      SET is_occupied = EXISTS (
        SELECT 1 FROM public.residents res
        WHERE res.room_id = OLD.room_id AND res.is_active = true
      )
      WHERE r.id = OLD.room_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update OLD room occupancy after deletion
    UPDATE public.rooms r
    SET is_occupied = EXISTS (
      SELECT 1 FROM public.residents res
      WHERE res.room_id = OLD.room_id AND res.is_active = true
    )
    WHERE r.id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
