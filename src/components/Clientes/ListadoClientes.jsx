import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatFecha } from '../../lib/formatters'
import { useAuth } from '../../context/AuthContext'

function EstadoBadge({ estado }) {
  const map = {
    activo: 'badge-activo',
    atrasado: 'badge-atrasado',
    mora: 'badge-mora',
    incobrable: 'badge-incobrable',
    cancelado: 'badge-cancelado',
    ok: 'badge-activo'
  }
  const labels = {
    activo: 'Al día',
    atrasado: 'Atrasado',
    mora: 'En mora',
    incobrable: 'Incobrable',
    cancelado: 'Cancelado',
    ok: 'OK'
  }
  return <span className={map[estado] || 'badge-activo'}>{labels[estado] || estado}</span>
}

export default function ListadoClientes() {
  const { isAdmin, userNombre } = useAuth()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 20

  useEffect(() => {
    cargarClientes()
  }, [])

  async function cargarClientes() {
    setLoading(true)
    try {
      let query = supabase
        .from('clientes')
        .select(`*, creditos(id, estado, importe_cuota, periodicidad)`)
        .order('created_at', { ascending: false })

      if (isAdmin) {
        query = query.neq('propietario', 'Carlos')
      } else {
        query = query.eq('propietario', userNombre)
      }

      const { data, error } = await query

      if (error) throw error
      setClientes(data || [])
    } catch (e) {
      console.error('Error cargando clientes', e)
    } finally {
      setLoading(false)
    }
  }

  function estadoGeneral(creditos) {
    if (!creditos || creditos.length === 0) return 'activo'
    if (creditos.some(c => c.estado === 'incobrable')) return 'incobrable'
    if (creditos.some(c => c.estado === 'mora')) return 'mora'
    if (creditos.some(c => c.estado === 'atrasado')) return 'atrasado'
    return 'activo'
  }

  const filtrados = clientes.filter(c => {
    const q = busqueda.toLowerCase()
    return (
      c.nombre?.toLowerCase().includes(q) ||
      c.apellido?.toLowerCase().includes(q) ||
      c.dni?.includes(q) ||
      c.codigo?.toLowerCase().includes(q) ||
      c.localidad?.toLowerCase().includes(q)
    )
  })

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const pagActual = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  if (loading) return (
    <div className="card flex items-center justify-center h-48">
      <div className="text-gray-400">Cargando clientes...</div>
    </div>
  )

  return (
    <div className="card">
      {/* Buscador */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, código o localidad..."
            className="input-field pl-9"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          />
        </div>
        <span className="text-sm text-gray-500">{filtrados.length} clientes</span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Código</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Apellido y Nombre</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">DNI</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Celular</th>
              <th className="text-left py-3 px-2 text-gray-600 font-semibold">Localidad</th>
              <th className="text-center py-3 px-2 text-gray-600 font-semibold">Créditos</th>
              <th className="text-center py-3 px-2 text-gray-600 font-semibold">Estado</th>
              <th className="text-right py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {pagActual.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400">
                  {busqueda ? 'Sin resultados para la búsqueda' : 'No hay clientes registrados'}
                </td>
              </tr>
            ) : (
              pagActual.map(cliente => {
                const creditosActivos = (cliente.creditos || []).filter(c =>
                  ['activo', 'atrasado', 'mora'].includes(c.estado)
                )
                const estado = estadoGeneral(cliente.creditos || [])
                return (
                  <tr key={cliente.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-mono text-xs text-blue-700">{cliente.codigo}</td>
                    <td className="py-3 px-2 font-medium">
                      {cliente.apellido}, {cliente.nombre}
                    </td>
                    <td className="py-3 px-2 text-gray-600">{cliente.dni}</td>
                    <td className="py-3 px-2 text-gray-600">{cliente.celular}</td>
                    <td className="py-3 px-2 text-gray-600">{cliente.localidad}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="font-semibold">{creditosActivos.length}</span>
                      <span className="text-gray-400 text-xs"> activos</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <EstadoBadge estado={estado} />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/creditos/nuevo?cliente=${cliente.id}`}
                          className="text-orange-600 hover:underline text-xs font-medium">
                          + Crédito
                        </Link>
                        <Link to={`/clientes/${cliente.id}`}
                          className="text-blue-600 hover:underline text-xs font-medium">
                          Ver detalle →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-100"
            >← Ant.</button>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-100"
            >Sig. →</button>
          </div>
        </div>
      )}
    </div>
  )
}
