-- Índice EAN -> SKU de Dux, usado por /api/precio-por-ean para autocompletar
-- el precio en la Consulta de cuotas a partir del código de barras escaneado.
-- Lo llena el sync de "Consulta de Precios" (proyecto aparte, mismo negocio).
CREATE TABLE IF NOT EXISTS indice_ean (
  ean TEXT PRIMARY KEY,
  cod_item TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sin autenticación de usuarios en este sistema (mismo criterio que el resto de las tablas)
ALTER TABLE indice_ean DISABLE ROW LEVEL SECURITY;
