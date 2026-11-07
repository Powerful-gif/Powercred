-- Vuelve atrás migration_exigir_2fa.sql. Usar solo si el sistema dejó de
-- funcionar después de aplicarla: la base vuelve a aceptar solo la contraseña.

DROP POLICY IF EXISTS "Exige sesion con 2FA" ON clientes;
DROP POLICY IF EXISTS "Exige sesion con 2FA" ON creditos;
DROP POLICY IF EXISTS "Exige sesion con 2FA" ON cuotas;
DROP POLICY IF EXISTS "Exige sesion con 2FA" ON pagos;
DROP POLICY IF EXISTS "Exige sesion con 2FA" ON configuracion;
DROP POLICY IF EXISTS "Exige sesion con 2FA" ON solicitudes_web;
