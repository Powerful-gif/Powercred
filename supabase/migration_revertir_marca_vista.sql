-- Revierte la vista a solo rubro/sub_rubro (sin marca). Agregar marca a la
-- vista hacía que tuviera 1.472 filas, y Supabase corta en 1.000 filas por
-- consulta (no se puede pedir más aunque se pida explícitamente) — por eso
-- se perdían los rubros que empiezan después de la "L" alfabéticamente.
-- La marca ahora se consulta aparte, filtrada por rubro (ver accion=marcas
-- en api/buscar-catalogo.js), que siempre devuelve mucho menos de 1.000 filas.
DROP VIEW IF EXISTS v_rubros_subrubros;

CREATE VIEW v_rubros_subrubros AS
SELECT DISTINCT rubro, sub_rubro
FROM catalogo_dux
WHERE stock > 0 AND rubro IS NOT NULL
ORDER BY rubro, sub_rubro;
