-- ============================================================
-- MIGRACIÓN: Refinanciar créditos y registrar cobros por abogado
-- Ejecutar una sola vez en el SQL Editor de Supabase
-- ============================================================
-- Estados nuevos de crédito:
--   refinanciado     -> su deuda pasó a un crédito nuevo (refinancia_credito_id)
--   cobrado_abogado  -> incobrable que se recuperó por vía legal
-- Estado nuevo de cuota:
--   refinanciada     -> cuota que no se pagó porque pasó al crédito nuevo

DO $$
DECLARE
  v_nombre TEXT;
BEGIN
  FOR v_nombre IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'creditos'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LOOP
    EXECUTE format('ALTER TABLE creditos DROP CONSTRAINT %I', v_nombre);
  END LOOP;
  FOR v_nombre IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'cuotas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LOOP
    EXECUTE format('ALTER TABLE cuotas DROP CONSTRAINT %I', v_nombre);
  END LOOP;
END $$;

ALTER TABLE creditos ADD CONSTRAINT creditos_estado_check
  CHECK (estado IN ('activo', 'atrasado', 'mora', 'incobrable', 'cancelado', 'refinanciado', 'cobrado_abogado'));
ALTER TABLE cuotas ADD CONSTRAINT cuotas_estado_check
  CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'mora', 'refinanciada'));

ALTER TABLE creditos ADD COLUMN IF NOT EXISTS refinancia_credito_id UUID REFERENCES creditos(id) ON DELETE SET NULL;
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS abogado_monto NUMERIC CHECK (abogado_monto >= 0);
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS abogado_fecha DATE;
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS abogado_observaciones TEXT;

-- Cierra el crédito viejo una vez creado el nuevo que lo refinancia. En una
-- sola operación, para que nunca quede a medias. Respeta los permisos de
-- quien la llama (incluido el 2FA obligatorio).
CREATE OR REPLACE FUNCTION marcar_refinanciado(p_viejo UUID, p_nuevo UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM creditos WHERE id = p_nuevo AND refinancia_credito_id = p_viejo) THEN
    RAISE EXCEPTION 'El crédito nuevo no refinancia a este crédito';
  END IF;

  UPDATE creditos SET estado = 'refinanciado'
   WHERE id = p_viejo AND estado IN ('activo', 'atrasado', 'mora', 'incobrable');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este crédito ya estaba cerrado o refinanciado';
  END IF;

  UPDATE cuotas SET estado = 'refinanciada'
   WHERE credito_id = p_viejo AND estado <> 'pagada';
END;
$$;

REVOKE ALL ON FUNCTION marcar_refinanciado(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marcar_refinanciado(UUID, UUID) TO authenticated;
