import { createClient } from '@supabase/supabase-js'

const DUX_BASE = 'https://erp.duxsoftware.com.ar/WSERP/rest/services'
const TN_BASE = 'https://api.tiendanube.com/2025-03'

async function buscarSkuPorEan(ean) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data, error } = await supabase
    .from('indice_ean')
    .select('cod_item')
    .eq('ean', ean)
    .single()
  if (error || !data) return null
  return data.cod_item
}

async function buscarItemDux(codItem) {
  const r = await fetch(`${DUX_BASE}/items?codigoItem=${encodeURIComponent(codItem)}`, {
    headers: { Authorization: process.env.DUX_TOKEN, 'Content-Type': 'application/json' },
  })
  if (!r.ok) throw new Error(`Dux ${r.status}`)
  const data = await r.json()
  return data.results?.[0] || null
}

function precioPvp(raw) {
  const listaId = Number(process.env.DUX_LISTA_PVP_ID)
  const p = (raw.precios || []).find(p => p.id === listaId)
  return p ? parseFloat(p.precio) : 0
}

function stockDeposito(raw) {
  const depositoId = Number(process.env.DUX_DEPOSITO_ID)
  const s = (raw.stock || []).find(s => s.id === depositoId)
  return s ? parseFloat(s.ctd_disponible) : 0
}

async function buscarProductoTN(codItem) {
  const storeId = process.env.TN_STORE_ID
  const r = await fetch(`${TN_BASE}/${storeId}/products/sku/${encodeURIComponent(codItem)}`, {
    headers: {
      Authorization: `Bearer ${process.env.TN_TOKEN}`,
      'User-Agent': 'sistema-creditos (info.powerfulshop@gmail.com)',
    },
  })
  if (r.status === 404) return null
  if (!r.ok) return null
  return r.json()
}

async function generarCaracteristicasIA(nombre, marca, rubro) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ''
  const prompt =
    `Producto: ${nombre}\nMarca: ${marca || 'desconocida'}\nRubro: ${rubro || 'desconocido'}\n\n` +
    'Este producto todavía no tiene ficha publicada en la tienda online. ' +
    'Dame en 3-4 líneas cortas las características más importantes que un ' +
    'vendedor debería saber para atender a un cliente en el mostrador ' +
    '(qué es, para qué sirve, qué suele buscar la gente en este tipo de ' +
    'producto). NO inventes medidas, watts, litros u otras specs numéricas ' +
    'puntuales que no te di — hablá en términos generales del tipo de producto. ' +
    'Responde en texto plano, sin markdown (nada de #, *, guiones de lista).'

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) return ''
    const data = await r.json()
    return data.content?.[0]?.text?.trim() || ''
  } catch {
    return ''
  }
}

export default async function handler(req, res) {
  const ean = (req.query.ean || '').trim()
  if (!ean) return res.status(400).json({ error: 'Falta el código de barras.' })

  let codItem
  try {
    codItem = await buscarSkuPorEan(ean)
  } catch (e) {
    return res.status(502).json({ error: 'Error consultando el índice de productos.' })
  }
  if (!codItem) {
    return res.status(404).json({
      error: `El código ${ean} no está en el índice. Puede ser un producto nuevo — avisá para resincronizar el catálogo.`,
    })
  }

  let raw
  try {
    raw = await buscarItemDux(codItem)
  } catch (e) {
    return res.status(502).json({ error: 'Error consultando Dux.' })
  }
  if (!raw) {
    return res.status(404).json({ error: `El SKU ${codItem} ya no existe en Dux.` })
  }

  const nombre = raw.item || ''
  const marca = raw.marca?.marca || null
  const rubro = raw.rubro?.nombre || null
  const subRubro = raw.sub_rubro?.nombre || null
  const precioPVP = precioPvp(raw)
  const stock = stockDeposito(raw)

  let descripcionHtml = ''
  let imagenes = []
  let fuenteDescripcion = null

  const productoTN = await buscarProductoTN(codItem)
  if (productoTN) {
    descripcionHtml = productoTN.description?.es || ''
    imagenes = (productoTN.images || []).map(img => img.src).filter(Boolean)
    if (descripcionHtml.trim()) fuenteDescripcion = 'web'
  }

  if (!fuenteDescripcion) {
    const textoIA = await generarCaracteristicasIA(nombre, marca, rubro)
    if (textoIA) {
      descripcionHtml = `<p>${textoIA.replace(/\n/g, '<br>')}</p>`
      fuenteDescripcion = 'ia'
    }
  }

  return res.status(200).json({
    sku: codItem,
    ean,
    nombre,
    marca,
    rubro,
    sub_rubro: subRubro,
    precio_pvp: precioPVP,
    stock,
    descripcion_html: descripcionHtml,
    fuente_descripcion: fuenteDescripcion,
    imagenes: imagenes.slice(0, 3),
  })
}
