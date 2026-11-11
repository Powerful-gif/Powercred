-- ============================================================
-- MIGRACIÓN: Cobrar préstamos privados elegidos desde el local
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de
-- migration_prestamos_compartidos.sql
-- ============================================================
-- Los préstamos marcados con cobrable_en_local se pueden cobrar desde Cobros
-- del sistema común. Las cuentas del negocio NO reciben acceso a las tablas
-- pp_*: solo pueden usar estas tres funciones, que devuelven lo justo para
-- cobrar (persona, cuotas, saldo) y nunca quién prestó, la ganancia ni la caja.

ALTER TABLE pp_prestamos ADD COLUMN IF NOT EXISTS cobrable_en_local BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pp_pagos ADD COLUMN IF NOT EXISTS cobrado_en_local BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION pp_local_cuotas_pendientes()
RETURNS TABLE (
  cuota_id UUID,
  prestamo_numero BIGINT,
  nombre TEXT,
  apellido TEXT,
  dni TEXT,
  numero_cuota INTEGER,
  cantidad_cuotas INTEGER,
  fecha_vencimiento DATE,
  saldo NUMERIC,
  tasa_mora_diaria NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Se requiere la verificación en dos pasos';
  END IF;

  RETURN QUERY
  SELECT c.id, p.numero, pe.nombre, pe.apellido, pe.dni, c.numero_cuota, p.cantidad_cuotas,
         c.fecha_vencimiento, c.importe_original - c.importe_pagado, p.tasa_mora_diaria
    FROM pp_cuotas c
    JOIN pp_prestamos p ON p.id = c.prestamo_id
    JOIN pp_personas pe ON pe.id = p.persona_id
   WHERE p.cobrable_en_local
     AND p.estado <> 'incobrable'
     AND c.estado <> 'pagada'
   ORDER BY pe.apellido, pe.nombre, p.numero, c.numero_cuota;
END;
$$;

CREATE OR REPLACE FUNCTION pp_local_registrar_pago(
  p_cuota_id UUID,
  p_importe NUMERIC,
  p_mora NUMERIC,
  p_metodo TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cuota pp_cuotas%ROWTYPE;
  v_saldo NUMERIC;
  v_pago_id UUID;
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
  IF COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Se requiere la verificación en dos pasos';
  END IF;

  SELECT c.* INTO v_cuota
    FROM pp_cuotas c
    JOIN pp_prestamos p ON p.id = c.prestamo_id
   WHERE c.id = p_cuota_id
     AND p.cobrable_en_local
     AND p.estado <> 'incobrable'
     FOR UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta cuota no se puede cobrar en el local';
  END IF;

  IF p_importe < 0 OR p_mora < 0 OR p_importe + p_mora <= 0 THEN
    RAISE EXCEPTION 'Importe inválido';
  END IF;
  IF p_metodo NOT IN ('efectivo', 'transferencia') THEN
    RAISE EXCEPTION 'Método de pago inválido';
  END IF;

  v_saldo := v_cuota.importe_original - v_cuota.importe_pagado;
  IF p_importe > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'El importe supera el saldo de la cuota';
  END IF;

  INSERT INTO pp_pagos (prestamo_id, cuota_id, fecha_pago, importe, mora, metodo_pago, cobrado_en_local)
  VALUES (v_cuota.prestamo_id, p_cuota_id, v_hoy, p_importe, p_mora, p_metodo, true)
  RETURNING id INTO v_pago_id;

  UPDATE pp_cuotas
     SET importe_pagado = LEAST(importe_original, importe_pagado + p_importe),
         fecha_pago = GREATEST(fecha_pago, v_hoy),
         estado = CASE WHEN v_saldo - p_importe <= 0.005 THEN 'pagada' ELSE 'pendiente' END
   WHERE id = p_cuota_id;

  RETURN v_pago_id;
END;
$$;

-- Lo cobrado en el local en un rango de fechas, para que la caja cuadre
CREATE OR REPLACE FUNCTION pp_local_cobrado(p_desde DATE, p_hasta DATE)
RETURNS TABLE (fecha_pago DATE, importe NUMERIC, mora NUMERIC, metodo_pago TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Se requiere la verificación en dos pasos';
  END IF;

  RETURN QUERY
  SELECT g.fecha_pago, g.importe, g.mora, g.metodo_pago
    FROM pp_pagos g
   WHERE g.cobrado_en_local
     AND g.fecha_pago BETWEEN p_desde AND p_hasta
   ORDER BY g.fecha_pago;
END;
$$;

REVOKE ALL ON FUNCTION pp_local_cuotas_pendientes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pp_local_registrar_pago(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pp_local_cobrado(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pp_local_cuotas_pendientes() TO authenticated;
GRANT EXECUTE ON FUNCTION pp_local_registrar_pago(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION pp_local_cobrado(DATE, DATE) TO authenticated;
