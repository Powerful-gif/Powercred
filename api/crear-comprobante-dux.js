const DUX_BASE = 'https://erp.duxsoftware.com.ar/WSERP/rest/services'

// Config fija de la cuenta de Dux (Casa Central)
const ID_EMPRESA = 3878
const ID_SUCURSAL_EMPRESA = 1
const NRO_PTO_VTA = '7'
const ID_PERSONAL = 3789678 // BARCO, JULIAN

function fechaDDMMYYYY() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}${mm}${d.getFullYear()}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' })

  const { cliente, productos } = req.body || {}
  if (!cliente?.apellido || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o productos.' })
  }

  const body = {
    fecha_comprobante: fechaDDMMYYYY(),
    categoria_fiscal: 'CONSUMIDOR_FINAL',
    apellido_razon_soc: `${cliente.apellido} ${cliente.nombre || ''}`.trim(),
    id_empresa: ID_EMPRESA,
    id_sucursal_empresa: ID_SUCURSAL_EMPRESA,
    nro_pto_vta: NRO_PTO_VTA,
    id_personal: ID_PERSONAL,
    id_deposito: Number(process.env.DUX_DEPOSITO_ID),
    productos: productos.map(p => ({
      cod_item: p.sku,
      ctd: Number(p.cantidad),
      porc_desc: '0',
      precio_uni: Number(p.precio),
    })),
    tipo_entrega: 'ENTREGA_INMEDIATA',
    tipo_comp: 'COMPROBANTE_VENTA',
    ...(cliente.dni ? { tipo_doc: 'DNI', nro_doc: Number(cliente.dni) } : {}),
  }

  try {
    const r = await fetch(`${DUX_BASE}/factura/nuevaFactura`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: process.env.DUX_TOKEN,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => null)
    if (!r.ok) {
      return res.status(502).json({ error: 'Dux rechazó el comprobante.', detalle: data })
    }
    return res.status(200).json({ ok: true, dux: data })
  } catch (e) {
    return res.status(502).json({ error: 'Error consultando Dux.' })
  }
}
