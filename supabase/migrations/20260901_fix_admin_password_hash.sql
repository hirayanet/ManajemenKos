-- Fix admin password hash to use a valid bcrypt hash for 'admin123'
-- Previous hash was malformed; this is the correct bcrypt hash
UPDATE public.admins 
SET password_hash = '$2b$10$5zpmXUI7kRe8dmpKqB5jaenXGWOmIejbRp9I7rO9xE2rtmJIuUUci'
WHERE email = 'admin@kosan.com';
