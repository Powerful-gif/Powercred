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
│   ├── AuthContext.jsx    # Contexto de autenticación/sesión
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
│   ├── Consulta.jsx       # Calculadora de financiación + búsqueda por EAN/SKU
│   ├── Creditos.jsx       # Módulo de créditos
│   ├── Reportes.jsx       # Módulo de reportes
│   ├── Autorizacion.jsx   # Pantalla de autorización de acceso
│   ├── Importar.jsx       # Importación de datos
│   ├── Solicitar.jsx      # Landing pública PowerCred/PowerCash (sin login)
│   ├── SolicitudesWeb.jsx # Panel para gestionar las solicitudes recibidas
│   └── Login.jsx          # Pantalla de inicio de sesión
├── App.jsx                # Routing principal
├── index.css              # Estilos globales con TailwindCSS
└── main.jsx               # Punto de entrada
api/
├── precio-por-ean.js      # Busca precio/stock por EAN o SKU (Dux + Tienda Nube + IA)
├── buscar-catalogo.js     # Búsqueda por rubro/sub-rubro en el catálogo
├── bcra-cheques.js        # Consulta de cheques rechazados (BCRA)
└── bcra-deudas.js         # Consulta de situación crediticia (BCRA)
supabase/
├── schema.sql                       # Schema base de datos
├── migration_catalogo_dux.sql       # Migración: catálogo sincronizado desde Dux
├── migration_indice_ean.sql         # Migración: índice EAN → SKU
├── migration_metodo_pago.sql        # Migración: método de pago
└── migration_solicitudes_web.sql    # Migración: solicitudes desde la landing pública
```

---

## SOLICITUDES WEB — LANDING PÚBLICA POWERCRED / POWERCASH

`/solicitar` es una ruta **pública, sin login**, pensada para linkear desde
Instagram, WhatsApp o los banners de Tienda Nube. Muestra dos opciones con la
estética de Powerful:

- **PowerCred** — crédito para comprar en el local (`/solicitar?producto=credito`)
- **PowerCash** — préstamo en efectivo (`/solicitar?producto=efectivo`)

El visitante completa nombre, apellido, DNI y celular; el formulario inserta
una fila directo en la tabla `solicitudes_web` de Supabase (ver
`supabase/migration_solicitudes_web.sql` — hay que correrla una vez en el SQL
Editor de Supabase). Esa tabla tiene Row Level Security: cualquiera puede
insertar una solicitud nueva, pero solo un usuario logueado en el sistema
puede leerlas o modificarlas.

Las solicitudes se gestionan desde **Solicitudes Web** en el menú lateral
(`src/pages/SolicitudesWeb.jsx`): cambiar el estado (nueva / contactada /
convertida / descartada) o apretar "Convertir en cliente" para abrir el alta
de cliente con nombre, apellido, DNI y celular ya precargados.

---

## CONSULTA DE CUOTAS — BÚSQUEDA POR CÓDIGO DE BARRAS / SKU

La pantalla "Consulta" (`src/pages/Consulta.jsx`) tiene un campo de código de
barras arriba del precio. Al escanear/tipear un EAN o un SKU y apretar Enter:

1. Llama a la función serverless `api/precio-por-ean.js` (Vercel).
2. Esa función busca a qué SKU corresponde el EAN en la tabla `indice_ean` de
   Supabase (la API de Dux no soporta buscar directamente por EAN — se probó
   en vivo y cualquier parámetro que no sea `codigoItem` lo ignora). Si el
   código no está en el índice, prueba usarlo directo como SKU.
3. Con el SKU, consulta **en vivo** el precio y stock a la API de Dux.
4. Busca la ficha del producto ya publicada en Tienda Nube (powerfulshop.com.ar)
   para mostrar características reales; si el producto todavía no está
   publicado, genera un resumen corto con IA (Claude) como respaldo.
5. Autocompleta el campo "Precio del artículo" con el resultado (igual se
   puede editar a mano).

**De dónde sale la tabla `indice_ean`:** la llena un proyecto aparte,
[`ConsultaPrecios`](https://github.com/Powerful-gif/ConsultaPrecios) (Python +
Flask, para consultas de precio desde una tablet en el local). Ese repo tiene
un workflow de GitHub Actions (`.github/workflows/sync.yml`) que corre todas
las noches a las 3 AM (hora Argentina) y resincroniza el catálogo completo de
Dux hacia Supabase — corre en la nube, no depende de que ninguna PC esté
prendida.

**Variables de entorno que necesita este proyecto en Vercel** (Settings →
Environments → Production) para que `api/precio-por-ean.js` funcione:
`DUX_TOKEN`, `DUX_DEPOSITO_ID`, `DUX_LISTA_PVP_ID`, `TN_TOKEN`, `TN_STORE_ID`,
`ANTHROPIC_API_KEY` — además de las `VITE_SUPABASE_*` que ya usa el resto del
sistema.

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
