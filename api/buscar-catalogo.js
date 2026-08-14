import { createClient } from '@supabase/supabase-js'

// Si se completa esta lista, el buscador por rubro solo va a mostrar estos
// (útil para no marear con categorías que no interesa vender por acá).
// Dejar vacío ([]) para mostrar todos los rubros disponibles.
const RUBROS_HABILITADOS = [
  'CLIMATIZACION',
  'COCINAS Y HORNOS',
  'COLCHONES Y SOMMIERS',
  'CORTADORAS DE CESPED',
  'CUIDADO PERSONAL',
  'HELADERAS Y FREEZERS',
  'LAVADO',
  'MOVILIDAD',
  'MUEBLES',
  'PEQUEÑOS COCINA',
  'PEQUEÑOS HOGAR',
  'TERMOTANQUES',
  'TV, AUDIO Y VIDEO',
  'TECNOLOGIA',
]

function supa() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
}

export default async function handler(req, res) {
  const { accion } = req.query
  const supabase = supa()

  if (accion === 'rubros') {
    const { data, error } = await supabase
      .from('v_rubros_subrubros')
      .select('rubro, sub_rubro')
    if (error) return res.status(502).json({ error: 'Error consultando rubros.' })

    const filtrado = RUBROS_HABILITADOS.length
      ? data.filter(r => RUBROS_HABILITADOS.includes(r.rubro))
      : data
    return res.status(200).json(filtrado)
  }

  if (accion === 'rubros_admin') {
    const { data, error } = await supabase
      .from('v_rubros_subrubros')
      .select('rubro')
    if (error) return res.status(502).json({ error: 'Error consultando rubros.' })
    const rubrosUnicos = [...new Set((data || []).map(r => r.rubro))].filter(Boolean).sort()
    return res.status(200).json(rubrosUnicos)
  }

  const { rubro, sub_rubro, nombre } = req.query
  let query = supabase
    .from('catalogo_dux')
    .select('sku, nombre, marca, rubro, sub_rubro, precio, stock')
    .gt('stock', 0)

  if (rubro) query = query.eq('rubro', rubro)
  if (sub_rubro) query = query.eq('sub_rubro', sub_rubro)
  if (nombre) query = query.ilike('nombre', `%${nombre}%`)

  query = query.order('marca', { ascending: true }).order('nombre', { ascending: true }).limit(200)

  const { data, error } = await query
  if (error) return res.status(502).json({ error: 'Error consultando el catálogo.' })
  return res.status(200).json(data)
}
