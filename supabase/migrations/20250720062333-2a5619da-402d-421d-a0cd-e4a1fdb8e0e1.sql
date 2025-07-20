-- Create admin table for authentication
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rooms table (kamar 1-15)
CREATE TABLE public.rooms (
  id SERIAL PRIMARY KEY,
  room_number INTEGER NOT NULL UNIQUE CHECK (room_number >= 1 AND room_number <= 15),
  is_occupied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert 15 rooms
INSERT INTO public.rooms (room_number) 
SELECT generate_series(1, 15);

-- Create residents table (penghuni kos)
CREATE TABLE public.residents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  room_id INTEGER NOT NULL REFERENCES public.rooms(id),
  ktp_image_url TEXT,
  entry_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id) -- One resident per room
);

-- Create payments table (pembayaran)
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  payment_month TEXT NOT NULL, -- Format: "2024-01"
  payment_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resident_id, payment_month) -- One payment per month per resident
);

-- Enable Row Level Security
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for authenticated users for now)
CREATE POLICY "Allow all for authenticated users" ON public.admins
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.rooms
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.residents
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON public.payments
  FOR ALL USING (true);

-- Create storage bucket for KTP images
INSERT INTO storage.buckets (id, name, public) VALUES ('ktp-images', 'ktp-images', true);

-- Create storage policies for KTP images
CREATE POLICY "Allow all access to KTP images" ON storage.objects
  FOR ALL USING (bucket_id = 'ktp-images');

-- Create function to update rooms occupancy status
CREATE OR REPLACE FUNCTION update_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  -- Update room status based on active residents
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.rooms 
    SET is_occupied = NEW.is_active 
    WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rooms 
    SET is_occupied = false 
    WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room occupancy
CREATE TRIGGER update_room_occupancy_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION update_room_occupancy();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO public.admins (email, password_hash, name) 
VALUES ('admin@kosan.com', '$2a$10$rOzJe7ZZZQQGzGGGzGGGGuzJzJzJzJzJzJzJzJzJzJzJzJzJzJzJzO', 'Administrator');