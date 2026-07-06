const DUX_BASE = 'https://erp.duxsoftware.com.ar/WSERP/rest/services'

async function get(path) {
  const r = await fetch(`${DUX_BASE}${path}`, {
    headers: { Authorization: process.env.DUX_TOKEN, 'Content-Type': 'application/json' },
  })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, data }
}

export default async function handler(req, res) {
  const que = req.query.que || 'empresas'

  if (que === 'empresas') {
    return res.status(200).json(await get('/empresas'))
  }
  if (que === 'sucursales') {
    const idEmpresa = req.query.idEmpresa || '3878'
    return res.status(200).json(await get(`/sucursales?idEmpresa=${idEmpresa}`))
  }
  if (que === 'personales') {
    return res.status(200).json(await get('/personales'))
  }
  return res.status(400).json({ error: 'Parámetro "que" inválido. Usar: empresas, sucursales o personales.' })
}
