const URL_DOLAR = casa => `https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`
// Variable 12 del BCRA: tasa nominal anual de depósitos a 30 días
const URL_TASA_30_DIAS = desde =>
  `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/12?desde=${desde}&limit=3000`

async function obtenerJson(url) {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function armarDolar(cotizaciones, desde) {
  return cotizaciones
    .filter(c => c.fecha >= desde)
    .map(c => ({ fecha: c.fecha, valor: (Number(c.compra) + Number(c.venta)) / 2 }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Convierte la tasa anual en un índice que crece día a día, como un plazo fijo
// que se renueva con sus intereses. Cada tramo usa la última tasa publicada.
export function armarPlazoFijo(detalle, hoy) {
  const tasas = [...detalle].sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (tasas.length === 0) return []
  const serie = [{ fecha: tasas[0].fecha, valor: 100 }]
  const puntos = tasas[tasas.length - 1].fecha < hoy ? [...tasas, { fecha: hoy }] : tasas
  for (let i = 1; i < puntos.length; i++) {
    const dias = (new Date(puntos[i].fecha) - new Date(puntos[i - 1].fecha)) / 86400000
    const anterior = serie[serie.length - 1].valor
    serie.push({ fecha: puntos[i].fecha, valor: anterior * (1 + (puntos[i - 1].valor / 100) * (dias / 365)) })
  }
  return serie
}

export default async function handler(req, res) {
  const hoy = new Date().toISOString().slice(0, 10)
  const unAnio = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : unAnio

  const [blue, oficial, tasas] = await Promise.allSettled([
    obtenerJson(URL_DOLAR('blue')),
    obtenerJson(URL_DOLAR('oficial')),
    obtenerJson(URL_TASA_30_DIAS(desde)),
  ])

  return res.status(200).json({
    dolarBlue: blue.status === 'fulfilled' ? armarDolar(blue.value, desde) : [],
    dolarOficial: oficial.status === 'fulfilled' ? armarDolar(oficial.value, desde) : [],
    plazoFijo: tasas.status === 'fulfilled' ? armarPlazoFijo(tasas.value.results?.[0]?.detalle || [], hoy) : [],
  })
}
