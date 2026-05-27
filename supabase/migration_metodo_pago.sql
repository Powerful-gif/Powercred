-- Agregar columna método de pago a la tabla pagos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'efectivo';
