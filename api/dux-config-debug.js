const DUX_BASE = 'https://erp.duxsoftware.com.ar/WSERP/rest/services'

async function get(path) {
  const r = await fetch(`${DUX_BASE}${path}`, {
    headers: { Authorization: process.env.DUX_TOKEN, 'Content-Type': 'application/json' },
  })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data }
}

export default async function handler(req, res) {
  const empresas = await get('/empresas')
  let sucursales = null
  const primeraEmpresaId = empresas.data?.results?.[0]?.id ?? empresas.data?.[0]?.id
  if (primeraEmpresaId) {
    sucursales = await get(`/sucursales?idEmpresa=${primeraEmpresaId}`)
  }
  const personales = await get('/personales')

  return res.status(200).json({ empresas, sucursales, personales })
}
