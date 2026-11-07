-- ============================================================
-- MIGRACIÓN: Caja de Préstamos privados
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de
-- migration_prestamos_privados.sql
-- ============================================================
-- Ahorros y retiros de cada prestador. Lo disponible para prestar se calcula
-- con estos movimientos más los préstamos y cobros de ese prestador.

CREATE TABLE IF NOT EXISTS pp_caja_movimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamista_id UUID NOT NULL REFERENCES pp_prestamistas(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('ahorro', 'retiro')),
  importe NUMERIC NOT NULL CHECK (importe > 0),
  fecha DATE NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_caja_prestamista ON pp_caja_movimientos(prestamista_id);

ALTER TABLE pp_caja_movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pp_caja_movimientos FROM anon;

CREATE POLICY "Solo con acceso a prestamos privados"
  ON pp_caja_movimientos FOR ALL TO authenticated
  USING (pp_tiene_acceso())
  WITH CHECK (pp_tiene_acceso());
