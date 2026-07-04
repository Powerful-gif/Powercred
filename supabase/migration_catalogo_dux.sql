-- Catálogo completo de Dux (nombre, marca, rubro, sub_rubro, precio, stock),
-- usado por /api/buscar-catalogo para el buscador por rubro/sub-rubro en la
-- Consulta de cuotas. Lo llena el sync nocturno de "Consulta de Precios"
-- (mismo repo/negocio, ver README.md).
CREATE TABLE IF NOT EXISTS catalogo_dux (
  sku TEXT PRIMARY KEY,
  nombre TEXT,
  marca TEXT,
  rubro TEXT,
  sub_rubro TEXT,
  precio NUMERIC,
  stock NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE catalogo_dux DISABLE ROW LEVEL SECURITY;

-- Rubros/sub-rubros disponibles (solo los que tienen stock), para llenar los
-- desplegables del buscador sin traer las ~11 mil filas del catálogo entero.
CREATE OR REPLACE VIEW v_rubros_subrubros AS
SELECT DISTINCT rubro, sub_rubro
FROM catalogo_dux
WHERE stock > 0 AND rubro IS NOT NULL
ORDER BY rubro, sub_rubro;
