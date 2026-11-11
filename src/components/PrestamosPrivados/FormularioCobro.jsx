import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calcularMora } from '../../lib/calculos'
import { formatMoneda, hoyArgentina } from '../../lib/formatters'

export default function FormularioCobro({ prestamo, cuota, onCobrado, onCancelar }) {
  const saldo = Number(cuota.importe_original) - Number(cuota.importe_pagado)
  const [importe, setImporte] = useState(saldo.toFixed(2))
  const [mora, setMora] = useState(() =>
    calcularMora(saldo, cuota.fecha_vencimiento, Number(prestamo.tasa_mora_diaria)).mora.toFixed(2)
  )
  const [fecha, setFecha] = useState(hoyArgentina())
  const [metodo, setMetodo] = useState('efectivo')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const participantes = prestamo.pp_participaciones || []
  const total = (parseFloat(importe) || 0) + (parseFloat(mora) || 0)
  const reparto = participantes
    .map(x => `${x.pp_prestamistas?.nombre} ${formatMoneda((total * Number(x.monto)) / Number(prestamo.capital))}`)
    .join(' · ')

  async function confirmar() {
    const importeNum = parseFloat(importe) || 0
    const moraNum = parseFloat(mora) || 0
    if (importeNum < 0 || moraNum < 0 || importeNum + moraNum <= 0) return setError('Ingresá un importe válido.')
    if (importeNum > saldo + 0.005) return setError('El importe supera el saldo de la cuota.')

    setGuardando(true)
    const { error: e } = await supabase.rpc('pp_registrar_pago', {
      p_cuota_id: cuota.id,
      p_importe: importeNum,
      p_mora: moraNum,
      p_fecha: fecha,
      p_metodo: metodo,
      p_observaciones: '',
    })
    setGuardando(false)
    if (e) return setError('No se pudo registrar el cobro: ' + e.message)
    onCobrado()
  }

  return (
    <div className="mt-4 border-2 border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
      <div className="font-semibold text-blue-900">Cobrar cuota {cuota.numero_cuota}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label text-xs">Importe de la cuota</label>
          <input type="number" className="input-field" min="0" step="0.01" value={importe}
            onChange={e => setImporte(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Punitorio</label>
          <input type="number" className="input-field" min="0" step="0.01" value={mora}
            onChange={e => setMora(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Fecha</label>
          <input type="date" className="input-field" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Método</label>
          <select className="input-field" value={metodo} onChange={e => setMetodo(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
      </div>
      {participantes.length > 1 && (
        <div className="text-sm text-blue-900">Le corresponde a cada uno: {reparto}</div>
      )}
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-3">
        <button onClick={confirmar} disabled={guardando} className="btn-primary disabled:opacity-50">
          {guardando ? 'Guardando...' : 'Confirmar cobro'}
        </button>
        <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
      </div>
    </div>
  )
}
