-- Migration: Menambahkan kolom untuk langganan tambahan akses Wi-Fi
-- Tabel: payments
-- Kolom: wifi_devices (jumlah perangkat tambahan), wifi_fee (biaya langganan tambahan wifi)

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS wifi_devices INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wifi_fee NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.payments.wifi_devices IS 'Jumlah perangkat tambahan untuk akses Wi-Fi (default: 0)';
COMMENT ON COLUMN public.payments.wifi_fee IS 'Biaya tambahan langganan akses Wi-Fi (default: 0)';
