const URL_IPC_OFICIAL = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&sort=asc&format=json'
const URL_IPC_MENSUAL = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion'

async function obtenerJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// El índice oficial (INDEC vía datos.gob.ar) suele publicarse con unas semanas
// de demora respecto de la variación mensual. Los meses que todavía no están
// se completan aplicando esa variación sobre el último índice oficial.
export function armarSerie(oficial, mensual) {
  const serie = (oficial || []).map(([fecha, indice]) => ({ mes: fecha.slice(0, 7), indice, estimado: false }))
  const mensualOrdenado = [...(mensual || [])].sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (serie.length === 0) {
    let indice = 100
    return mensualOrdenado.map(({ fecha, valor }) => {
      indice *= 1 + valor / 100
      return { mes: fecha.slice(0, 7), indice, estimado: true }
    })
  }

  for (const { fecha, valor } of mensualOrdenado) {
    const mes = fecha.slice(0, 7)
    const ultimo = serie[serie.length - 1]
    if (mes > ultimo.mes) serie.push({ mes, indice: ultimo.indice * (1 + valor / 100), estimado: true })
  }
  return serie
}

export default async function handler(req, res) {
  const [oficial, mensual] = await Promise.allSettled([
    obtenerJson(URL_IPC_OFICIAL),
    obtenerJson(URL_IPC_MENSUAL),
  ])

  const serie = armarSerie(
    oficial.status === 'fulfilled' ? oficial.value.data : [],
    mensual.status === 'fulfilled' ? mensual.value : []
  )

  if (serie.length === 0) {
    return res.status(502).json({ error: 'No se pudo obtener la inflación.' })
  }
  return res.status(200).json({ serie })
}
