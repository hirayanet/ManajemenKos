-- Add marital status and marriage document URL columns to residents table
ALTER TABLE public.residents 
ADD COLUMN marital_status text CHECK (marital_status IN ('Lajang', 'Menikah')) DEFAULT 'Lajang',
ADD COLUMN marriage_document_url text;