import { createClient } from '@supabase/supabase-js'

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
  if (que === 'estadoFactura') {
    const idProceso = req.query.idProceso
    if (!idProceso) return res.status(400).json({ error: 'Falta idProceso' })
    return res.status(200).json(await get(`/obtenerEstadoFactura?idProceso=${idProceso}`))
  }
  if (que === 'rubrosTodos') {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('v_rubros_subrubros').select('rubro').ilike('rubro', `%${req.query.filtro || ''}%`)
    if (error) return res.status(502).json({ error: error.message })
    return res.status(200).json([...new Set(data.map(r => r.rubro))].sort())
  }
  return res.status(400).json({ error: 'Parámetro "que" inválido. Usar: empresas, sucursales, personales, estadoFactura o rubrosTodos.' })
}
