import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calcularMora } from '../../lib/calculos'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'
import { numeroPrestamo } from '../../lib/prestamosPrivados'

function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Préstamos particulares que el dueño marcó para cobrar en el local. La cuenta
// del negocio no ve las tablas: solo estas funciones con lo justo para cobrar.
export default function CobroParticulares() {
  const [cuotas, setCuotas] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cobro, setCobro] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const hoy = hoyArgentina()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data, error: e } = await supabase.rpc('pp_local_cuotas_pendientes')
    if (e) setError('No se pudieron cargar los préstamos particulares.')
    else setCuotas(data)
  }

  function abrirCobro(c) {
    const saldo = Number(c.saldo)
    setAviso('')
    setCobro({
      cuota: c,
      importe: saldo.toFixed(2),
      mora: calcularMora(saldo, c.fecha_vencimiento, Number(c.tasa_mora_diaria)).mora.toFixed(2),
      metodo: 'efectivo',
      error: '',
    })
  }

  async function confirmar() {
    const importe = parseFloat(cobro.importe) || 0
    const mora = parseFloat(cobro.mora) || 0
    if (importe < 0 || mora < 0 || importe + mora <= 0) return setCobro(prev => ({ ...prev, error: 'Ingresá un importe válido.' }))
    if (importe > Number(cobro.cuota.saldo) + 0.005) return setCobro(prev => ({ ...prev, error: 'El importe supera el saldo de la cuota.' }))

    setGuardando(true)
    const { error: e } = await supabase.rpc('pp_local_registrar_pago', {
      p_cuota_id: cobro.cuota.cuota_id,
      p_importe: importe,
      p_mora: mora,
      p_metodo: cobro.metodo,
    })
    setGuardando(false)
    if (e) return setCobro(prev => ({ ...prev, error: 'No se pudo registrar el cobro: ' + e.message }))
    setAviso(`Cobro registrado: ${formatMoneda(importe + mora)} de ${cobro.cuota.apellido}, ${cobro.cuota.nombre}.`)
    setCobro(null)
    cargar()
  }

  if (error) return <div className="card text-center py-12 text-red-600">{error}</div>
  if (!cuotas) return <div className="text-center py-12 text-gray-400">Cargando...</div>

  const texto = normalizar(busqueda.trim())
  const visibles = texto
    ? cuotas.filter(c => normalizar(`${c.nombre} ${c.apellido} ${c.dni || ''} ${numeroPrestamo(c.prestamo_numero)}`).includes(texto))
    : cuotas

  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-sm text-gray-500 mb-3">
          Préstamos particulares que se cobran en el local. Lo cobrado acá va aparte de la plata del negocio.
        </p>
        <input
          type="text"
          className="input-field"
          placeholder="Buscar por nombre, DNI o número de préstamo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {aviso && <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">{aviso}</div>}

      <div className="card">
        {visibles.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No hay cuotas para cobrar{texto ? ' con esa búsqueda' : ''}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Persona</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Préstamo</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Saldo</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Punitorio</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(c => {
                  const saldo = Number(c.saldo)
                  const { mora } = calcularMora(saldo, c.fecha_vencimiento, Number(c.tasa_mora_diaria))
                  const vencida = c.fecha_vencimiento < hoy
                  return (
                    <tr key={c.cuota_id} className={`border-b border-gray-100 ${vencida ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-2 font-medium">
                        {c.apellido}, {c.nombre}
                        {c.dni && <div className="text-xs text-gray-400">DNI {c.dni}</div>}
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{numeroPrestamo(c.prestamo_numero)}</td>
                      <td className="py-2 px-2 text-center">{c.numero_cuota}/{c.cantidad_cuotas}</td>
                      <td className={`py-2 px-2 ${vencida ? 'text-red-600 font-semibold' : ''}`}>{formatFecha(c.fecha_vencimiento)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(saldo)}</td>
                      <td className="py-2 px-2 text-right text-orange-600">{mora > 0 ? formatMoneda(mora) : '-'}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => abrirCobro(c)} className="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700">
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {cobro && (
          <div className="mt-4 border-2 border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
            <div className="font-semibold text-green-900">
              Cobrar a {cobro.cuota.apellido}, {cobro.cuota.nombre} · cuota {cobro.cuota.numero_cuota}/{cobro.cuota.cantidad_cuotas}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">Importe de la cuota</label>
                <input type="number" className="input-field" min="0" step="0.01" value={cobro.importe}
                  onChange={e => setCobro(prev => ({ ...prev, importe: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Punitorio</label>
                <input type="number" className="input-field" min="0" step="0.01" value={cobro.mora}
                  onChange={e => setCobro(prev => ({ ...prev, mora: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Método</label>
                <select className="input-field" value={cobro.metodo} onChange={e => setCobro(prev => ({ ...prev, metodo: e.target.value }))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-green-900">
              Total a cobrar: <strong>{formatMoneda((parseFloat(cobro.importe) || 0) + (parseFloat(cobro.mora) || 0))}</strong>
            </div>
            {cobro.error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{cobro.error}</div>}
            <div className="flex gap-3">
              <button onClick={confirmar} disabled={guardando} className="btn-primary disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Confirmar cobro'}
              </button>
              <button onClick={() => setCobro(null)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
