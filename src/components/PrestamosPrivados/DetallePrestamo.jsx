import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calcularMora } from '../../lib/calculos'
import { formatMoneda, formatFecha } from '../../lib/formatters'
import { escalarPrestamo, nombresPrestadores, numeroPrestamo, resumirPrestamo } from '../../lib/prestamosPrivados'
import { ESTADOS_PRESTAMO } from '../../pages/PrestamosPrivados'
import FormularioCobro from './FormularioCobro'

export default function DetallePrestamo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prestamo, setPrestamo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cuotaACobrar, setCuotaACobrar] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function cargar() {
    const { data } = await supabase
      .from('pp_prestamos')
      .select('*, pp_personas(*), pp_participaciones(prestamista_id, monto, pp_prestamistas(nombre)), pp_cuotas(*), pp_pagos(*)')
      .eq('id', id)
      .maybeSingle()
    setPrestamo(data)
    setCargando(false)
  }

  async function anularPago(pago) {
    if (!window.confirm(`¿Anular el cobro de ${formatMoneda(Number(pago.importe) + Number(pago.mora))}?`)) return
    const { error: e } = await supabase.rpc('pp_anular_pago', { p_pago_id: pago.id })
    if (e) return setError('No se pudo anular el cobro: ' + e.message)
    cargar()
  }

  async function cambiarCobroLocal(e) {
    const { error: err } = await supabase.from('pp_prestamos').update({ cobrable_en_local: e.target.checked }).eq('id', id)
    if (err) return setError('No se pudo cambiar el cobro en el local.')
    cargar()
  }

  async function cambiarIncobrable() {
    const estado = prestamo.estado === 'incobrable' ? 'activo' : 'incobrable'
    const pregunta = estado === 'incobrable' ? '¿Marcar este préstamo como incobrable?' : '¿Volver a activar este préstamo?'
    if (!window.confirm(pregunta)) return
    const { error: e } = await supabase.from('pp_prestamos').update({ estado }).eq('id', id)
    if (e) return setError('No se pudo cambiar el estado.')
    cargar()
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar este préstamo con todas sus cuotas y cobros? No se puede deshacer.')) return
    const { error: e } = await supabase.from('pp_prestamos').delete().eq('id', id)
    if (e) return setError('No se pudo eliminar el préstamo.')
    navigate('/prestamos-privados/lista')
  }

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (!prestamo) return <div className="card text-center py-12 text-gray-400">No se encontró el préstamo.</div>

  const resumen = resumirPrestamo(prestamo)
  const estado = ESTADOS_PRESTAMO[resumen.estado]
  const cuotas = [...prestamo.pp_cuotas].sort((a, b) => a.numero_cuota - b.numero_cuota)
  const pagos = [...prestamo.pp_pagos].sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago))
  const persona = prestamo.pp_personas
  const participantes = (prestamo.pp_participaciones || []).map(x => ({
    id: x.prestamista_id,
    nombre: x.pp_prestamistas?.nombre,
    monto: Number(x.monto),
    parte: Number(x.monto) / Number(prestamo.capital),
  }))
  const repartir = importe => participantes.map(x => `${x.nombre} ${formatMoneda(importe * x.parte)}`).join(' · ')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/prestamos-privados/lista" className="text-sm text-gray-500 hover:text-gray-700">← Volver a préstamos</Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-sm text-blue-700">{numeroPrestamo(prestamo.numero)}</div>
            <h2 className="text-xl font-bold text-gray-900">{persona?.apellido}, {persona?.nombre}</h2>
            <div className="text-sm text-gray-500">
              {participantes.length > 1 ? 'Prestaron' : 'Prestó'} {nombresPrestadores(prestamo)} · {formatFecha(prestamo.fecha_inicio)}
              {persona?.celular ? ` · ${persona.celular}` : ''}
            </div>
          </div>
          <span className={estado.cls}>{estado.label}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div>
            <div className="text-xs text-gray-500">Capital prestado</div>
            <div className="font-bold text-gray-900">{formatMoneda(resumen.capital)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Capital por volver</div>
            <div className="font-bold text-blue-800">{formatMoneda(resumen.capitalPendiente)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ganancia cobrada</div>
            <div className="font-bold text-green-700">{formatMoneda(resumen.interesCobrado + resumen.moraCobrada)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Interés por cobrar</div>
            <div className="font-bold text-gray-900">{formatMoneda(resumen.interesPendiente)}</div>
          </div>
        </div>
        {prestamo.observaciones && <p className="text-sm text-gray-500 mt-4">{prestamo.observaciones}</p>}
      </div>

      {participantes.length > 1 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Reparto entre los que prestaron</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Quién</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Puso</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Parte</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Le cobraron</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Su ganancia</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Le falta volver</th>
                </tr>
              </thead>
              <tbody>
                {participantes.map(x => {
                  const r = resumirPrestamo(escalarPrestamo(prestamo, x.parte))
                  return (
                    <tr key={x.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{x.nombre}</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(x.monto)}</td>
                      <td className="py-2 px-2 text-right">{(x.parte * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(r.cobradoCuotas + r.moraCobrada)}</td>
                      <td className="py-2 px-2 text-right text-green-700">{formatMoneda(r.interesCobrado + r.moraCobrada)}</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(r.capitalPendiente)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Cuotas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Cuota</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Importe</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Saldo</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Punitorio</th>
                <th className="text-right py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map(c => {
                const saldo = Number(c.importe_original) - Number(c.importe_pagado)
                const pagada = c.estado === 'pagada'
                const { mora } = pagada ? { mora: 0 } : calcularMora(saldo, c.fecha_vencimiento, Number(prestamo.tasa_mora_diaria))
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium">{c.numero_cuota}/{prestamo.cantidad_cuotas}</td>
                    <td className="py-2 px-2">{formatFecha(c.fecha_vencimiento)}</td>
                    <td className="py-2 px-2 text-right">{formatMoneda(c.importe_original)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{pagada ? '-' : formatMoneda(saldo)}</td>
                    <td className="py-2 px-2 text-right text-orange-600">{mora > 0 ? formatMoneda(mora) : '-'}</td>
                    <td className="py-2 px-2 text-right">
                      {pagada ? (
                        <span className="text-green-600 text-xs font-medium">Pagada</span>
                      ) : (
                        <button onClick={() => setCuotaACobrar(c)} className="text-blue-600 hover:underline text-xs font-medium">Cobrar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {cuotaACobrar && (
          <FormularioCobro
            key={cuotaACobrar.id}
            prestamo={prestamo}
            cuota={cuotaACobrar}
            onCobrado={() => { setCuotaACobrar(null); cargar() }}
            onCancelar={() => setCuotaACobrar(null)}
          />
        )}
      </div>

      {pagos.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Cobros registrados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Punitorio</th>
                  {participantes.length > 1 && <th className="text-left py-2 px-2 text-gray-500 font-medium">Corresponde</th>}
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Método</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 px-2">{formatFecha(p.fecha_pago)}</td>
                    <td className="py-2 px-2 text-right">{formatMoneda(p.importe)}</td>
                    <td className="py-2 px-2 text-right">{Number(p.mora) > 0 ? formatMoneda(p.mora) : '-'}</td>
                    {participantes.length > 1 && <td className="py-2 px-2 text-xs text-gray-600">{repartir(Number(p.importe) + Number(p.mora))}</td>}
                    <td className="py-2 px-2 capitalize">
                      {p.metodo_pago}
                      {p.cobrado_en_local && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">En el local</span>}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => anularPago(p)} className="text-red-500 hover:underline text-xs">Anular</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input type="checkbox" checked={!!prestamo.cobrable_en_local} onChange={cambiarCobroLocal} />
          Se puede cobrar en el local
        </label>
        <button onClick={cambiarIncobrable} className="text-gray-500 hover:underline">
          {prestamo.estado === 'incobrable' ? 'Volver a activar' : 'Marcar como incobrable'}
        </button>
        <button onClick={eliminar} className="text-red-500 hover:underline">Eliminar préstamo</button>
      </div>
    </div>
  )
}
