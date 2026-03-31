-- Create dedicated private storage bucket for uploaded birth certificates
-- (hospital-issued documents, distinct from generated baptism certificates).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('birth-certificates', 'birth-certificates', false, 5242880)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit;
