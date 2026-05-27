-- ============================================================
-- POWERCRED - Schema SQL para Supabase
-- Ejecutar este archivo en el SQL Editor de Supabase
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT UNIQUE NOT NULL,
  celular TEXT NOT NULL,
  celular_alternativo TEXT,
  domicilio TEXT NOT NULL,
  codigo_postal TEXT,
  localidad TEXT NOT NULL,
  provincia TEXT DEFAULT 'Córdoba',
  capacidad_pago_mensual NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: creditos
-- ============================================================
CREATE TABLE IF NOT EXISTS creditos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero_credito TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo', 'hogar')),
  importe_original NUMERIC NOT NULL,
  tasa_interes_porcentaje NUMERIC NOT NULL,
  tasa_efectiva_anual NUMERIC,
  costo_financiero_total NUMERIC,
  total_con_intereses NUMERIC NOT NULL,
  cantidad_cuotas INTEGER NOT NULL,
  periodicidad TEXT NOT NULL CHECK (periodicidad IN ('mensual', 'semanal')),
  importe_cuota NUMERIC NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_primer_vencimiento DATE NOT NULL,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'atrasado', 'mora', 'incobrable', 'cancelado')),
  vendedor TEXT,
  cobrador TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cuotas
-- ============================================================
CREATE TABLE IF NOT EXISTS cuotas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credito_id UUID REFERENCES creditos(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  importe_original NUMERIC NOT NULL,
  importe_pagado NUMERIC DEFAULT 0,
  interes_mora NUMERIC DEFAULT 0,
  total_cobrado NUMERIC DEFAULT 0,
  fecha_pago DATE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'mora'))
);

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cuota_id UUID REFERENCES cuotas(id),
  credito_id UUID REFERENCES creditos(id),
  cliente_id UUID REFERENCES clientes(id),
  fecha_pago DATE NOT NULL,
  importe_cuota NUMERIC NOT NULL,
  dias_atraso INTEGER DEFAULT 0,
  interes_mora NUMERIC DEFAULT 0,
  total_cobrado NUMERIC NOT NULL,
  cobrador TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: configuracion
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  id TEXT PRIMARY KEY DEFAULT 'global',
  datos JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración por defecto
INSERT INTO configuracion (id, datos) VALUES ('global', '{
  "negocio": {
    "nombre": "POWERFUL",
    "subtitulo": "PRÉSTAMOS",
    "direccion": "Pedro C. Molina N° 318",
    "localidad": "Almafuerte",
    "provincia": "Córdoba",
    "telefono": ""
  },
  "pagare": {
    "localidad": "Almafuerte",
    "acreedor": "Secchiari Caroline",
    "cuit": "27-17111940-0",
    "direccion": "Pedro C. Molina N° 318",
    "ciudad": "Almafuerte"
  },
  "mora": {
    "tasa_diaria": 0.3
  },
  "tasas": {
    "hogar": {
      "mensual": {"3": 12, "6": 24, "9": 42, "12": 60},
      "semanal": {"4": 4, "8": 8, "12": 12, "16": 16, "20": 20, "24": 24}
    },
    "efectivo": {
      "mensual": {"3": 24, "6": 48, "9": 72},
      "semanal": {"4": 8, "8": 16, "12": 24, "16": 32, "20": 40, "24": 48}
    }
  }
}') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_creditos_cliente_id ON creditos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_creditos_estado ON creditos(estado);
CREATE INDEX IF NOT EXISTS idx_cuotas_credito_id ON cuotas(credito_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas(estado);
CREATE INDEX IF NOT EXISTS idx_cuotas_fecha_vencimiento ON cuotas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_id ON pagos(credito_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_clientes_dni ON clientes(dni);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes(codigo);

-- ============================================================
-- ROW LEVEL SECURITY
-- Desactivado para uso interno (sin autenticación de usuarios)
-- Si se agrega auth en el futuro, activar estas políticas
-- ============================================================
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE creditos DISABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
