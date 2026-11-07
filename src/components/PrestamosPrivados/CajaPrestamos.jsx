import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'
import { resumirCaja } from '../../lib/prestamosPrivados'

export default function CajaPrestamos({ prestamos, prestamistas }) {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [prestamistaId, setPrestamistaId] = useState('')
  const [tipo, setTipo] = useState('ahorro')
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(hoyArgentina())
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data, error: e } = await supabase
      .from('pp_caja_movimientos')
      .select('*')
      .order('created_at', { ascending: false })
    if (e) setError('No se pudo cargar la caja.')
    else setMovimientos(data)
    setCargando(false)
  }

  async function guardar() {
    const monto = parseFloat(importe)
    if (!prestamistaId || !(monto > 0) || !fecha) {
      setError('Elegí el prestador y cargá un importe.')
      return
    }
    setError('')
    setGuardando(true)
    const { error: e } = await supabase.from('pp_caja_movimientos').insert({
      prestamista_id: prestamistaId,
      tipo,
      importe: monto,
      fecha,
      observaciones: observaciones.trim() || null,
    })
    setGuardando(false)
    if (e) {
      setError('No se pudo guardar el movimiento.')
      return
    }
    setImporte('')
    setObservaciones('')
    cargar()
  }

  async function eliminar(movimiento) {
    if (!window.confirm(`¿Eliminar este movimiento de ${formatMoneda(movimiento.importe)}?`)) return
    const { error: e } = await supabase.from('pp_caja_movimientos').delete().eq('id', movimiento.id)
    if (e) {
      setError('No se pudo eliminar el movimiento.')
      return
    }
    cargar()
  }

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>

  const nombreDe = id => prestamistas.find(p => p.id === id)?.nombre

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prestamistas.map(p => {
          const caja = resumirCaja(movimientos, prestamos, p.id)
          return (
            <div key={p.id} className="card">
              <div className="text-sm text-gray-500">{p.nombre}</div>
              {caja ? (
                <>
                  <div className={`text-3xl font-bold mt-1 ${caja.disponible < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatMoneda(caja.disponible)}
                  </div>
                  <div className="text-xs text-gray-400 mb-3">Disponible para prestar</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Ahorros: <span className="text-gray-900 font-medium">{formatMoneda(caja.ahorros)}</span></div>
                    <div className="text-gray-500">Cobrado: <span className="text-gray-900 font-medium">{formatMoneda(caja.cobrado)}</span></div>
                    <div className="text-gray-500">Prestado: <span className="text-gray-900 font-medium">{formatMoneda(caja.prestado)}</span></div>
                    <div className="text-gray-500">Retiros: <span className="text-gray-900 font-medium">{formatMoneda(caja.retiros)}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-2">Sin caja. Se activa con el primer ahorro que cargues.</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800">Cargar movimiento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Prestador</label>
            <select className="input-field" value={prestamistaId} onChange={e => setPrestamistaId(e.target.value)}>
              <option value="">Elegir...</option>
              {prestamistas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input-field" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="ahorro">Ahorro</option>
              <option value="retiro">Retiro</option>
            </select>
          </div>
          <div>
            <label className="label">Importe</label>
            <input type="number" className="input-field" placeholder="Ej: 1500000" min="0" step="0.01"
              value={importe} onChange={e => setImporte(e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input-field" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <input type="text" className="input-field" placeholder="Nota (opcional)"
          value={observaciones} onChange={e => setObservaciones(e.target.value)} />
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">
          {guardando ? 'Guardando...' : 'Cargar'}
        </button>
      </div>

      {movimientos.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Movimientos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Prestador</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Tipo</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Importe</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Nota</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 px-2">{formatFecha(m.fecha)}</td>
                    <td className="py-2 px-2">{nombreDe(m.prestamista_id)}</td>
                    <td className="py-2 px-2 capitalize">{m.tipo}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${m.tipo === 'retiro' ? 'text-red-600' : 'text-green-700'}`}>
                      {m.tipo === 'retiro' ? '-' : '+'}{formatMoneda(m.importe)}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{m.observaciones || '-'}</td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => eliminar(m)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
