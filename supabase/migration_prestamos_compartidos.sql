-- ============================================================
-- MIGRACIÓN: Préstamos privados compartidos entre varios prestadores
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de
-- migration_prestamos_privados.sql y migration_prestamos_caja.sql
-- ============================================================
-- Cada préstamo guarda cuánto puso cada prestador (pp_participaciones). Los
-- cobros, la ganancia y la caja de cada uno salen de esa proporción.
--
-- Además separa "Matias - Julian" en "Matias" y "Julian", mitad y mitad:
-- sus préstamos y sus movimientos de caja (conservando la fecha en que se
-- cargaron, para que la caja siga empezando en el mismo momento).

CREATE TABLE IF NOT EXISTS pp_participaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id UUID NOT NULL REFERENCES pp_prestamos(id) ON DELETE CASCADE,
  prestamista_id UUID NOT NULL REFERENCES pp_prestamistas(id) ON DELETE RESTRICT,
  monto NUMERIC NOT NULL CHECK (monto > 0),
  UNIQUE (prestamo_id, prestamista_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_participaciones_prestamo ON pp_participaciones(prestamo_id);

ALTER TABLE pp_participaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pp_participaciones FROM anon;

CREATE POLICY "Solo con acceso a prestamos privados"
  ON pp_participaciones FOR ALL TO authenticated
  USING (pp_tiene_acceso())
  WITH CHECK (pp_tiene_acceso());

-- Los préstamos existentes pasan a tener un único participante por el total
INSERT INTO pp_participaciones (prestamo_id, prestamista_id, monto)
SELECT id, prestamista_id, capital FROM pp_prestamos WHERE prestamista_id IS NOT NULL
ON CONFLICT (prestamo_id, prestamista_id) DO NOTHING;

ALTER TABLE pp_prestamos ALTER COLUMN prestamista_id DROP NOT NULL;
UPDATE pp_prestamos SET prestamista_id = NULL;

DO $$
DECLARE
  v_conjunto UUID;
  v_matias UUID;
  v_julian UUID;
BEGIN
  SELECT id INTO v_conjunto FROM pp_prestamistas WHERE nombre = 'Matias - Julian';
  IF v_conjunto IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO pp_prestamistas (nombre) VALUES ('Matias'), ('Julian') ON CONFLICT (nombre) DO NOTHING;
  SELECT id INTO v_matias FROM pp_prestamistas WHERE nombre = 'Matias';
  SELECT id INTO v_julian FROM pp_prestamistas WHERE nombre = 'Julian';

  -- Préstamos: Matias se queda con la mitad redondeada y Julian con el resto,
  -- así los montos siempre suman el capital exacto.
  INSERT INTO pp_participaciones (prestamo_id, prestamista_id, monto)
  SELECT prestamo_id, v_matias, ROUND(monto / 2, 2) FROM pp_participaciones WHERE prestamista_id = v_conjunto
  UNION ALL
  SELECT prestamo_id, v_julian, monto - ROUND(monto / 2, 2) FROM pp_participaciones WHERE prestamista_id = v_conjunto;
  DELETE FROM pp_participaciones WHERE prestamista_id = v_conjunto;

  INSERT INTO pp_caja_movimientos (prestamista_id, tipo, importe, fecha, observaciones, created_at)
  SELECT v_matias, tipo, ROUND(importe / 2, 2), fecha, observaciones, created_at FROM pp_caja_movimientos WHERE prestamista_id = v_conjunto
  UNION ALL
  SELECT v_julian, tipo, importe - ROUND(importe / 2, 2), fecha, observaciones, created_at FROM pp_caja_movimientos WHERE prestamista_id = v_conjunto;
  DELETE FROM pp_caja_movimientos WHERE prestamista_id = v_conjunto;

  DELETE FROM pp_prestamistas WHERE id = v_conjunto;
END $$;

-- Ahora recibe "participaciones": [{ prestamista_id, monto }], que tienen que
-- sumar el capital. Si no vienen (pantalla vieja todavía abierta), usa el
-- prestamista_id con el total, como antes.
CREATE OR REPLACE FUNCTION pp_crear_prestamo(p_prestamo JSONB, p_cuotas JSONB)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_total_cuotas NUMERIC;
  v_participaciones JSONB;
  v_suma NUMERIC;
BEGIN
  SELECT COALESCE(SUM((c ->> 'importe_original')::NUMERIC), 0)
    INTO v_total_cuotas
    FROM jsonb_array_elements(p_cuotas) AS c;

  IF jsonb_array_length(p_cuotas) <> (p_prestamo ->> 'cantidad_cuotas')::INTEGER
     OR ABS(v_total_cuotas - (p_prestamo ->> 'total_con_intereses')::NUMERIC) > 0.01 THEN
    RAISE EXCEPTION 'Las cuotas no coinciden con el total del préstamo';
  END IF;

  v_participaciones := COALESCE(
    p_prestamo -> 'participaciones',
    jsonb_build_array(jsonb_build_object('prestamista_id', p_prestamo ->> 'prestamista_id', 'monto', p_prestamo ->> 'capital'))
  );

  SELECT COALESCE(SUM((x ->> 'monto')::NUMERIC), 0) INTO v_suma FROM jsonb_array_elements(v_participaciones) AS x;
  IF jsonb_array_length(v_participaciones) = 0
     OR ABS(v_suma - (p_prestamo ->> 'capital')::NUMERIC) > 0.01 THEN
    RAISE EXCEPTION 'Lo que pone cada prestador tiene que sumar el capital del préstamo';
  END IF;

  INSERT INTO pp_prestamos (
    persona_id, capital, tasa_interes_porcentaje, tasa_efectiva_anual,
    total_con_intereses, cantidad_cuotas, periodicidad, importe_cuota, tasa_mora_diaria,
    fecha_inicio, fecha_primer_vencimiento, observaciones
  ) VALUES (
    (p_prestamo ->> 'persona_id')::UUID,
    (p_prestamo ->> 'capital')::NUMERIC,
    (p_prestamo ->> 'tasa_interes_porcentaje')::NUMERIC,
    (p_prestamo ->> 'tasa_efectiva_anual')::NUMERIC,
    (p_prestamo ->> 'total_con_intereses')::NUMERIC,
    (p_prestamo ->> 'cantidad_cuotas')::INTEGER,
    p_prestamo ->> 'periodicidad',
    (p_prestamo ->> 'importe_cuota')::NUMERIC,
    (p_prestamo ->> 'tasa_mora_diaria')::NUMERIC,
    (p_prestamo ->> 'fecha_inicio')::DATE,
    (p_prestamo ->> 'fecha_primer_vencimiento')::DATE,
    NULLIF(p_prestamo ->> 'observaciones', '')
  )
  RETURNING id INTO v_id;

  INSERT INTO pp_participaciones (prestamo_id, prestamista_id, monto)
  SELECT v_id, (x ->> 'prestamista_id')::UUID, (x ->> 'monto')::NUMERIC
    FROM jsonb_array_elements(v_participaciones) AS x;

  INSERT INTO pp_cuotas (prestamo_id, numero_cuota, fecha_vencimiento, importe_original)
  SELECT v_id,
         (c ->> 'numero_cuota')::INTEGER,
         (c ->> 'fecha_vencimiento')::DATE,
         (c ->> 'importe_original')::NUMERIC
    FROM jsonb_array_elements(p_cuotas) AS c;

  RETURN v_id;
END;
$$;
