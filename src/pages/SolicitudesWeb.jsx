import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ESTADOS = {
  nueva: { label: 'Nueva', clase: 'bg-blue-100 text-blue-800' },
  contactada: { label: 'Contactada', clase: 'bg-yellow-100 text-yellow-800' },
  convertida: { label: 'Convertida', clase: 'bg-green-100 text-green-800' },
  descartada: { label: 'Descartada', clase: 'bg-gray-200 text-gray-600' },
}

const PRODUCTO_LABEL = { credito: 'PowerCred', efectivo: 'PowerCash' }

export default function SolicitudesWeb() {
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('solicitudes_web')
      .select('*')
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
    setLoading(false)
  }

  async function actualizarEstado(id, estado) {
    setSolicitudes(prev => prev.map(s => (s.id === id ? { ...s, estado } : s)))
    await supabase.from('solicitudes_web').update({ estado }).eq('id', id)
  }

  function convertirEnCliente(solicitud) {
    navigate('/clientes/nuevo', {
      state: {
        prefill: {
          nombre: solicitud.nombre,
          apellido: solicitud.apellido,
          dni: solicitud.dni,
          celular: solicitud.celular,
        },
        solicitudId: solicitud.id,
      },
    })
  }

  const visibles = filtro === 'todas' ? solicitudes : solicitudes.filter(s => s.estado === filtro)
  const nuevas = solicitudes.filter(s => s.estado === 'nueva').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-700">Solicitudes Web</h1>
          <p className="text-sm text-gray-400">Pedidos de crédito recibidos desde la landing pública</p>
        </div>
        {nuevas > 0 && (
          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {nuevas} nueva{nuevas !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {['todas', 'nueva', 'contactada', 'convertida', 'descartada'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filtro === f ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">No hay solicitudes para mostrar.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Producto</th>
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">DNI</th>
                <th className="pb-2 pr-4 font-medium">Celular</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(s => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{PRODUCTO_LABEL[s.producto] || s.producto}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{s.nombre} {s.apellido}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{s.dni}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{s.celular}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <select
                      value={s.estado}
                      onChange={e => actualizarEstado(s.id, e.target.value)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 ${ESTADOS[s.estado]?.clase || ''}`}
                    >
                      {Object.entries(ESTADOS).map(([valor, { label }]) => (
                        <option key={valor} value={valor}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {s.estado !== 'convertida' && (
                      <button
                        onClick={() => convertirEnCliente(s)}
                        className="text-orange-600 hover:text-orange-700 text-xs font-medium"
                      >
                        Convertir en cliente →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
