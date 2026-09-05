-- ============================================================
-- MIGRACIÓN: Agrega provincia y localidad a solicitudes_web
-- Ejecutar en el SQL Editor de Supabase (después de migration_solicitudes_web.sql)
-- ============================================================

ALTER TABLE solicitudes_web
  ADD COLUMN IF NOT EXISTS provincia TEXT NOT NULL DEFAULT 'Córdoba',
  ADD COLUMN IF NOT EXISTS localidad TEXT;
