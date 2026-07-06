const DUX_BASE = 'https://erp.duxsoftware.com.ar/WSERP/rest/services'

const espera = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function get(path) {
  const r = await fetch(`${DUX_BASE}${path}`, {
    headers: { Authorization: process.env.DUX_TOKEN, 'Content-Type': 'application/json' },
  })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data }
}

export default async function handler(req, res) {
  const empresas = await get('/empresas')
  const primeraEmpresaId = empresas.data?.results?.[0]?.id ?? empresas.data?.[0]?.id

  await espera(2000)
  const sucursales = primeraEmpresaId
    ? await get(`/sucursales?idEmpresa=${primeraEmpresaId}`)
    : null

  await espera(2000)
  const personales = await get('/personales')

  return res.status(200).json({ empresas, sucursales, personales })
}
