# POWERCRED - Sistema de Gestión de Créditos

Sistema web completo para gestión de créditos, clientes y cobros.

---

## REQUISITOS PREVIOS

- **Node.js 18 o superior** — Descargar desde: https://nodejs.org/
- Cuenta gratuita en **Supabase** — Crear en: https://supabase.com/

---

## PASO 1 - Crear proyecto en Supabase

1. Ir a https://supabase.com/ y crear una cuenta gratuita
2. Crear un nuevo proyecto (elegir región "South America (São Paulo)")
3. Anotar la **contraseña** de la base de datos (la necesitarás)
4. Una vez creado, ir a **Settings → API**
5. Copiar:
   - **Project URL** (ej: `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (clave larga que empieza con `eyJ...`)

---

## PASO 2 - Crear las tablas en Supabase

1. En Supabase, ir a **SQL Editor**
2. Hacer click en **New query**
3. Copiar todo el contenido del archivo `supabase/schema.sql`
4. Pegarlo en el editor y hacer click en **Run**
5. Verificar que dice "Success" (sin errores)

---

## PASO 3 - Configurar variables de entorno

1. En la carpeta del proyecto, copiar el archivo `.env.example` y renombrarlo a `.env`
2. Editar el archivo `.env` y completar con los datos de Supabase:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## PASO 4 - Instalar dependencias y ejecutar

Abrir una **terminal** (CMD o PowerShell) en la carpeta del proyecto y ejecutar:

```bash
npm install
```

Esperar a que se instalen todas las dependencias (~2 minutos).

Luego ejecutar:

```bash
npm run dev
```

El sistema estará disponible en:
- **Esta PC:** http://localhost:5173
- **Otras PCs en la red:** http://[IP-DE-ESTA-PC]:5173

Para saber la IP de tu PC en Windows: abrir CMD y escribir `ipconfig`, buscar "Dirección IPv4"

---

## ACCESO DESDE OTRAS PCS EN RED LOCAL

Para que otras computadoras en la misma red WiFi/LAN puedan acceder:

1. La PC que ejecuta el servidor debe tener el puerto 5173 habilitado en el firewall
2. En Windows: buscar "Firewall de Windows" → "Reglas de entrada" → Nueva regla → Puerto 5173 TCP
3. Las otras PCs acceden con: http://[IP-DE-LA-PC-SERVIDOR]:5173

---

## ESTRUCTURA DEL PROYECTO

```
src/
├── components/
│   ├── Clientes/          # Listado, formulario y ficha de cliente
│   ├── Cobros/            # Pantalla de cobranza y tarjeta de cuota
│   ├── Creditos/          # Nuevo crédito, listado y detalle
│   ├── Documentos/        # Tarjeta de cuotas y pagaré para imprimir
│   └── Layout/            # Sidebar, Header, Layout
├── context/
│   └── ConfigContext.jsx  # Contexto global de configuración
├── lib/
│   ├── calculos.js        # Lógica de cálculos (cuotas, TEA, mora, fechas)
│   ├── formatters.js      # Formateo de moneda, fechas, números a letras
│   └── supabase.js        # Cliente de Supabase
├── pages/
│   ├── Dashboard.jsx      # Pantalla de inicio con estadísticas
│   ├── Clientes.jsx       # Módulo de clientes
│   ├── Cobros.jsx         # Módulo de cobros
│   ├── Configuracion.jsx  # Panel de configuración
│   ├── Creditos.jsx       # Módulo de créditos
│   └── Reportes.jsx       # Módulo de reportes
├── App.jsx                # Routing principal
├── index.css              # Estilos globales con TailwindCSS
└── main.jsx               # Punto de entrada
supabase/
└── schema.sql             # Schema de base de datos
```

---

## TASAS DE INTERÉS CONFIGURADAS

### Crédito del Hogar - Cuotas mensuales
| Cuotas | Tasa |
|--------|------|
| 3      | 12%  |
| 6      | 24%  |
| 9      | 42%  |
| 12     | 60%  |

### Crédito del Hogar - Cuotas semanales
| Cuotas | Tasa |
|--------|------|
| 4      | 4%   |
| 8      | 8%   |
| 12     | 12%  |
| 16     | 16%  |
| 20     | 20%  |
| 24     | 24%  |

### Préstamo en Efectivo - Cuotas mensuales
| Cuotas | Tasa |
|--------|------|
| 3      | 24%  |
| 6      | 48%  |
| 9      | 72%  |

### Préstamo en Efectivo - Cuotas semanales
| Cuotas | Tasa |
|--------|------|
| 4      | 8%   |
| 8      | 16%  |
| 12     | 24%  |
| 16     | 32%  |
| 20     | 40%  |
| 24     | 48%  |

---

## LÓGICA DE NEGOCIO

### Estados de crédito
- **Activo**: todas las cuotas al día
- **Atrasado**: cuota vencida con 1-30 días de atraso
- **Mora**: cuota vencida con más de 30 días de atraso
- **Incobrable**: marcado manualmente, pasa a gestión legal
- **Cancelado**: todas las cuotas cobradas

### Interés de mora
- Tasa: 0.3% diario sobre el importe de la cuota
- Fórmula: `días_atraso × 0.003 × importe_cuota`

### Generación de fechas
- **Mensuales**: día 10 de cada mes (si cae sábado o domingo → siguiente lunes)
- **Semanales**: viernes de cada semana

### Cálculo del sistema
- Sistema de amortización directo (tasa cargada)
- `Total = Importe × (1 + tasa%)`
- `Cuota = Total / cantidad_cuotas`

---

## BACKUP

Desde el menú **Configuración → Backup**, podés exportar todos los datos a un archivo JSON.
Se recomienda hacer backup al menos 1 vez por semana.

---

## SOPORTE TÉCNICO

Para modificaciones o soporte, contactar al desarrollador con los datos del archivo `.env`.

---

*POWERCRED v1.0 - Sistema de Gestión de Créditos*
