-- ============================================================
-- MIGRACIÓN: Solicitudes web (PowerCred / PowerCash)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================
-- Guarda las solicitudes que llegan desde la landing pública
-- /solicitar (sin login). Cualquiera puede insertar una solicitud;
-- solo los usuarios logueados del sistema pueden verlas y editarlas.
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes_web (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto TEXT NOT NULL CHECK (producto IN ('credito', 'efectivo')),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL,
  celular TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'contactada', 'convertida', 'descartada')),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_web_estado ON solicitudes_web(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_web_created_at ON solicitudes_web(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- A diferencia del resto de las tablas (que hoy tienen RLS
-- deshabilitado), esta SÍ lo necesita: contiene DNI de gente que
-- todavía no es cliente y llega desde un formulario público sin
-- login, expuesto a cualquiera en internet.

ALTER TABLE solicitudes_web ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (sin sesión) puede cargar una solicitud nueva,
-- pero no puede leer ni modificar ninguna.
CREATE POLICY "Cualquiera puede crear una solicitud"
  ON solicitudes_web FOR INSERT
  TO anon
  WITH CHECK (true);

-- Solo un usuario logueado en el sistema (staff) puede ver y
-- gestionar las solicitudes.
CREATE POLICY "Usuarios logueados pueden ver solicitudes"
  ON solicitudes_web FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios logueados pueden actualizar solicitudes"
  ON solicitudes_web FOR UPDATE
  TO authenticated
  USING (true);
