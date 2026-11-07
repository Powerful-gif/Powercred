-- ============================================================
-- MIGRACIÓN: La base exige sesión verificada con 2FA
-- Ejecutar una sola vez en el SQL Editor de Supabase, sin clientes
-- en el local. Para volver atrás: revertir_exigir_2fa.sql
-- ============================================================
-- Hasta ahora alcanzaba con estar logueado (usuario y contraseña) para leer
-- o modificar estas tablas: el código de 2FA solo se pedía en la pantalla.
--
-- Son políticas RESTRICTIVE: se suman a las existentes y las dos tienen que
-- cumplirse. No afectan a anon, así que el formulario público de solicitudes
-- sigue funcionando sin login.

CREATE POLICY "Exige sesion con 2FA" ON clientes AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');

CREATE POLICY "Exige sesion con 2FA" ON creditos AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');

CREATE POLICY "Exige sesion con 2FA" ON cuotas AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');

CREATE POLICY "Exige sesion con 2FA" ON pagos AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');

CREATE POLICY "Exige sesion con 2FA" ON configuracion AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');

CREATE POLICY "Exige sesion con 2FA" ON solicitudes_web AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  WITH CHECK (COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');
