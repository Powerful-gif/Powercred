-- ============================================================
-- MIGRACIÓN: Protege clientes, créditos, cuotas, pagos y configuración
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================
-- HOY estas tablas tienen Row Level Security deshabilitado (así se
-- crearon en schema.sql). La pantalla de login del sistema controla
-- qué se ve en la pantalla, pero no impide que alguien le pida los
-- datos directo a la base: la "anon key" viaja igual dentro de la
-- página web (no es secreta, cualquiera puede verla), y sin RLS esa
-- clave alcanza para leer o modificar clientes/créditos aunque nunca
-- se haya iniciado sesión.
--
-- Esta migración exige sesión iniciada en el sistema para leer o
-- escribir estas tablas. Se probó que las únicas pantallas que las
-- usan (Dashboard, Clientes, Créditos, Cobros, Reportes, Configuración,
-- Importar, Autorización) ya están detrás del login, así que esto no
-- rompe nada para el equipo — solo cierra el acceso de afuera.
--
-- La landing pública /solicitar NO usa estas tablas (usa
-- solicitudes_web, que ya tiene su propia política), así que no se ve
-- afectada.

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo usuarios logueados acceden a clientes"
  ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo usuarios logueados acceden a creditos"
  ON creditos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo usuarios logueados acceden a cuotas"
  ON cuotas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo usuarios logueados acceden a pagos"
  ON pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Solo usuarios logueados acceden a configuracion"
  ON configuracion FOR ALL TO authenticated USING (true) WITH CHECK (true);
