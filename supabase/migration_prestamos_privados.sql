-- ============================================================
-- MIGRACIÓN: Préstamos privados (aparte del negocio)
-- Ejecutar una sola vez en el SQL Editor de Supabase
-- ============================================================
-- Estas tablas NO usan clientes/creditos/cuotas/pagos, y solo las pueden
-- leer o modificar los usuarios cargados en pp_acceso, con la sesión
-- verificada por 2FA (aal2). Lo exige la base: no alcanza con estar
-- logueado ni con conocer la clave pública de la página.

CREATE TABLE IF NOT EXISTS pp_acceso (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pp_acceso ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver su propia fila (para saber si tiene acceso).
-- Sin políticas de escritura: el acceso se otorga desde el SQL Editor.
CREATE POLICY "pp_acceso solo la fila propia"
  ON pp_acceso FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION pp_tiene_acceso()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.pp_acceso WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION pp_tiene_acceso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pp_tiene_acceso() TO authenticated;

CREATE TABLE IF NOT EXISTS pp_prestamistas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pp_personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  celular TEXT,
  domicilio TEXT,
  localidad TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pp_prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  prestamista_id UUID NOT NULL REFERENCES pp_prestamistas(id) ON DELETE RESTRICT,
  persona_id UUID NOT NULL REFERENCES pp_personas(id) ON DELETE RESTRICT,
  capital NUMERIC NOT NULL CHECK (capital > 0),
  tasa_interes_porcentaje NUMERIC NOT NULL CHECK (tasa_interes_porcentaje >= 0),
  tasa_efectiva_anual NUMERIC,
  total_con_intereses NUMERIC NOT NULL CHECK (total_con_intereses >= capital),
  cantidad_cuotas INTEGER NOT NULL CHECK (cantidad_cuotas > 0),
  periodicidad TEXT NOT NULL CHECK (periodicidad IN ('mensual', 'quincenal', 'semanal')),
  importe_cuota NUMERIC NOT NULL CHECK (importe_cuota > 0),
  tasa_mora_diaria NUMERIC NOT NULL DEFAULT 0.3 CHECK (tasa_mora_diaria >= 0),
  fecha_inicio DATE NOT NULL,
  fecha_primer_vencimiento DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'incobrable')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pp_cuotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id UUID NOT NULL REFERENCES pp_prestamos(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  importe_original NUMERIC NOT NULL CHECK (importe_original > 0),
  importe_pagado NUMERIC NOT NULL DEFAULT 0 CHECK (importe_pagado >= 0),
  fecha_pago DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  UNIQUE (prestamo_id, numero_cuota)
);

CREATE TABLE IF NOT EXISTS pp_pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id UUID NOT NULL REFERENCES pp_prestamos(id) ON DELETE CASCADE,
  cuota_id UUID NOT NULL REFERENCES pp_cuotas(id) ON DELETE CASCADE,
  fecha_pago DATE NOT NULL,
  importe NUMERIC NOT NULL CHECK (importe >= 0),
  mora NUMERIC NOT NULL DEFAULT 0 CHECK (mora >= 0),
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (importe + mora > 0)
);

CREATE INDEX IF NOT EXISTS idx_pp_cuotas_prestamo ON pp_cuotas(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pp_pagos_prestamo ON pp_pagos(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pp_pagos_cuota ON pp_pagos(cuota_id);

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['pp_prestamistas', 'pp_personas', 'pp_prestamos', 'pp_cuotas', 'pp_pagos']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('REVOKE ALL ON %I FROM anon', tabla);
    EXECUTE format(
      'CREATE POLICY "Solo con acceso a prestamos privados" ON %I FOR ALL TO authenticated USING (pp_tiene_acceso()) WITH CHECK (pp_tiene_acceso())',
      tabla
    );
  END LOOP;
END $$;

REVOKE ALL ON pp_acceso FROM anon;

-- Crea el préstamo y sus cuotas en una sola operación, para que nunca quede
-- un préstamo sin cuotas si algo falla a mitad de camino.
CREATE OR REPLACE FUNCTION pp_crear_prestamo(p_prestamo JSONB, p_cuotas JSONB)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_total_cuotas NUMERIC;
BEGIN
  SELECT COALESCE(SUM((c ->> 'importe_original')::NUMERIC), 0)
    INTO v_total_cuotas
    FROM jsonb_array_elements(p_cuotas) AS c;

  IF jsonb_array_length(p_cuotas) <> (p_prestamo ->> 'cantidad_cuotas')::INTEGER
     OR ABS(v_total_cuotas - (p_prestamo ->> 'total_con_intereses')::NUMERIC) > 0.01 THEN
    RAISE EXCEPTION 'Las cuotas no coinciden con el total del préstamo';
  END IF;

  INSERT INTO pp_prestamos (
    prestamista_id, persona_id, capital, tasa_interes_porcentaje, tasa_efectiva_anual,
    total_con_intereses, cantidad_cuotas, periodicidad, importe_cuota, tasa_mora_diaria,
    fecha_inicio, fecha_primer_vencimiento, observaciones
  ) VALUES (
    (p_prestamo ->> 'prestamista_id')::UUID,
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

  INSERT INTO pp_cuotas (prestamo_id, numero_cuota, fecha_vencimiento, importe_original)
  SELECT v_id,
         (c ->> 'numero_cuota')::INTEGER,
         (c ->> 'fecha_vencimiento')::DATE,
         (c ->> 'importe_original')::NUMERIC
    FROM jsonb_array_elements(p_cuotas) AS c;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pp_registrar_pago(
  p_cuota_id UUID,
  p_importe NUMERIC,
  p_mora NUMERIC,
  p_fecha DATE,
  p_metodo TEXT,
  p_observaciones TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuota pp_cuotas%ROWTYPE;
  v_saldo NUMERIC;
  v_pago_id UUID;
BEGIN
  SELECT * INTO v_cuota FROM pp_cuotas WHERE id = p_cuota_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la cuota';
  END IF;

  v_saldo := v_cuota.importe_original - v_cuota.importe_pagado;
  IF p_importe > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'El importe supera el saldo de la cuota';
  END IF;

  INSERT INTO pp_pagos (prestamo_id, cuota_id, fecha_pago, importe, mora, metodo_pago, observaciones)
  VALUES (v_cuota.prestamo_id, p_cuota_id, p_fecha, p_importe, p_mora, COALESCE(p_metodo, 'efectivo'), NULLIF(p_observaciones, ''))
  RETURNING id INTO v_pago_id;

  UPDATE pp_cuotas
     SET importe_pagado = LEAST(importe_original, importe_pagado + p_importe),
         fecha_pago = GREATEST(fecha_pago, p_fecha),
         estado = CASE WHEN v_saldo - p_importe <= 0.005 THEN 'pagada' ELSE 'pendiente' END
   WHERE id = p_cuota_id;

  RETURN v_pago_id;
END;
$$;

CREATE OR REPLACE FUNCTION pp_anular_pago(p_pago_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pago pp_pagos%ROWTYPE;
  v_cuota pp_cuotas%ROWTYPE;
BEGIN
  SELECT * INTO v_pago FROM pp_pagos WHERE id = p_pago_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el pago';
  END IF;

  SELECT * INTO v_cuota FROM pp_cuotas WHERE id = v_pago.cuota_id FOR UPDATE;

  DELETE FROM pp_pagos WHERE id = p_pago_id;

  UPDATE pp_cuotas
     SET importe_pagado = GREATEST(0, importe_pagado - v_pago.importe),
         fecha_pago = (SELECT MAX(fecha_pago) FROM pp_pagos WHERE cuota_id = v_cuota.id),
         estado = 'pendiente'
   WHERE id = v_cuota.id;
END;
$$;

REVOKE ALL ON FUNCTION pp_crear_prestamo(JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pp_registrar_pago(UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pp_anular_pago(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pp_crear_prestamo(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION pp_registrar_pago(UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION pp_anular_pago(UUID) TO authenticated;
