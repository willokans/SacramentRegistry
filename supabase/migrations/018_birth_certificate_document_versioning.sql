-- Add optional current birth-certificate pointer on baptisms and immutable version history table.
ALTER TABLE baptisms
ADD COLUMN IF NOT EXISTS birth_certificate_current_path TEXT;

CREATE TABLE IF NOT EXISTS baptism_document_versions (
  id BIGSERIAL PRIMARY KEY,
  baptism_id INTEGER NOT NULL REFERENCES baptisms(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type = 'BIRTH_CERTIFICATE'),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_baptism_document_versions_baptism_id
ON baptism_document_versions(baptism_id);

CREATE INDEX IF NOT EXISTS idx_baptism_document_versions_uploaded_at
ON baptism_document_versions(uploaded_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_baptism_document_versions_storage_path
ON baptism_document_versions(storage_path);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_baptism_document_versions_current
ON baptism_document_versions(baptism_id, document_type)
WHERE is_current = true;
