-- Suma la marca a la vista de rubros/sub-rubros, para poder filtrar por
-- marca (además de rubro/sub-rubro) en el buscador por categoría de Consulta,
-- sin traer las ~11 mil filas del catálogo entero.
CREATE OR REPLACE VIEW v_rubros_subrubros AS
SELECT DISTINCT rubro, sub_rubro, marca
FROM catalogo_dux
WHERE stock > 0 AND rubro IS NOT NULL
ORDER BY rubro, sub_rubro, marca;
