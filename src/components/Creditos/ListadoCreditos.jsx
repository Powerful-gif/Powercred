import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatMoneda, formatFecha } from '../../lib/formatters'
import { useAuth } from '../../context/AuthContext'

const ESTADOS = ['todos', 'activo', 'atrasado', 'mora', 'incobrable', 'cancelado']
const ESTADO_LABELS = {
  todos: 'Todos',
  activo: 'Al día',
  atrasado: 'Atrasado',
  mora: 'En mora',
  incobrable: 'Incobrable',
  cancelado: 'Cancelado'
}
const ESTADO_BADGE = {
  activo:     'badge-activo',
  atrasado:   'badge-atrasado',
  mora:       'badge-mora',
  incobrable: 'badge-incobrable',
  cancelado:  'badge-cancelado'
}

export default function ListadoCreditos() {
  const { isAdmin, userNombre } = useAuth()
  const [creditos, setCreditos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 20

  useEffect(() => {
    cargarCreditos()
  }, [])

  async function cargarCreditos() {
    setLoading(true)
    let query = supabase
      .from('creditos')
      .select('*, clientes(nombre, apellido, codigo, dni)')
      .order('created_at', { ascending: false })

    if (!isAdmin && userNombre) {
      query = query.or(`vendedor.eq.${userNombre},vendedor.is.null`)
    }

    const { data } = await query
    setCreditos(data || [])
    setLoading(false)
  }

  const filtrados = creditos.filter(c => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    const q = busqueda.toLowerCase()
    const matchBusq = !q ||
      c.numero_credito?.toLowerCase().includes(q) ||
      c.clientes?.nombre?.toLowerCase().includes(q) ||
      c.clientes?.apellido?.toLowerCase().includes(q) ||
      c.clientes?.dni?.includes(q) ||
      c.clientes?.codigo?.toLowerCase().includes(q) ||
      c.cobrador?.toLowerCase().includes(q) ||
      c.vendedor?.toLowerCase().includes(q)
    return matchEstado && matchBusq
  })

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const pagActual = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  if (loading) return (
    <div className="card flex items-center justify-center h-48">
      <div className="text-gray-400">Cargando créditos...</div>
    </div>
  )

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por N° crédito, cliente, DNI, cobrador..."
            className="input-field pl-9"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => { setFiltroEstado(e); setPagina(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroEstado === e
                  ? 'bg-blue-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {ESTADO_LABELS[e]}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-500">{filtrados.length} créditos</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">N° Crédito</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Cliente</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Tipo</th>
              <th className="text-right py-3 px-2 text-gray-600 font-semibold">Importe</th>
              <th className="text-center py-3 px-2 text-gray-600 font-semibold">Cuotas</th>
              <th className="text-right py-3 px-2 text-gray-600 font-semibold">Cuota</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Inicio</th>
              <th className="text-center py-3 px-2 text-gray-600 font-semibold">Estado</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Cobrador</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {pagActual.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-400">
                  Sin créditos para los filtros seleccionados
                </td>
              </tr>
            ) : (
              pagActual.map(cred => (
                <tr key={cred.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 font-mono text-xs font-semibold text-blue-700">
                    {cred.numero_credito}
                  </td>
                  <td className="py-3 px-2">
                    <div className="font-medium">{cred.clientes?.apellido}, {cred.clientes?.nombre}</div>
                    <div className="text-xs text-gray-400">{cred.clientes?.codigo}</div>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cred.tipo === 'hogar'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {cred.tipo === 'hogar' ? 'Hogar' : 'Efectivo'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold">{formatMoneda(cred.importe_original)}</td>
                  <td className="py-3 px-2 text-center text-gray-600">
                    {cred.cantidad_cuotas} {cred.periodicidad === 'mensual' ? 'men.' : 'sem.'}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600">{formatMoneda(cred.importe_cuota)}</td>
                  <td className="py-3 px-2 text-gray-600">{formatFecha(cred.fecha_inicio)}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={ESTADO_BADGE[cred.estado] || 'badge-activo'}>
                      {ESTADO_LABELS[cred.estado] || cred.estado}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-500 text-xs">{cred.cobrador || '-'}</td>
                  <td className="py-3 px-2 text-right">
                    <Link to={`/creditos/${cred.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">Página {pagina} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-100">
              ← Ant.
            </button>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-100">
              Sig. →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
