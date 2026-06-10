import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatMoneda, formatFecha, formatPorcentaje } from '../../lib/formatters'
import { calcularMora, calcularEstadoCredito } from '../../lib/calculos'
import { useConfig } from '../../context/ConfigContext'
import { useAuth } from '../../context/AuthContext'
import TarjetaCuotasDoc from '../Documentos/TarjetaCuotas'
import PagareDoc from '../Documentos/Pagare'

const ESTADO_BADGE = {
  activo:     'badge-activo',
  atrasado:   'badge-atrasado',
  mora:       'badge-mora',
  incobrable: 'badge-incobrable',
  cancelado:  'badge-cancelado'
}
const ESTADO_LABEL = {
  activo: 'Al día', atrasado: 'Atrasado', mora: 'En mora',
  incobrable: 'Incobrable', cancelado: 'Cancelado'
}
const CUOTA_BADGE = {
  pendiente: 'bg-gray-100 text-gray-600',
  pagada:    'bg-green-100 text-green-700',
  vencida:   'bg-orange-100 text-orange-700',
  mora:      'bg-red-100 text-red-700'
}

export default function DetalleCredito() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { config } = useConfig()
  const { isAdmin } = useAuth()
  const [credito, setCredito] = useState(null)
  const [cuotas, setCuotas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [docActivo, setDocActivo] = useState(null)
  const [confirmBorrar, setConfirmBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmAnular, setConfirmAnular] = useState(null)
  const [anulando, setAnulando] = useState(false)

  useEffect(() => {
    cargar()
  }, [id])

  async function cargar() {
    setLoading(true)
    const { data: cred } = await supabase
      .from('creditos')
      .select('*, clientes(*)')
      .eq('id', id)
      .single()
    const { data: ctas } = await supabase
      .from('cuotas')
      .select('*')
      .eq('credito_id', id)
      .order('numero_cuota')
    const { data: pgos } = await supabase
      .from('pagos')
      .select('*')
      .eq('credito_id', id)
      .order('created_at', { ascending: false })
    setCredito(cred)
    setCuotas(ctas || [])
    setPagos(pgos || [])
    setLoading(false)
  }

  function imprimirDoc(doc) {
    setDocActivo(doc)
    setTimeout(() => window.print(), 300)
  }

  async function anularCobro(pago) {
    setAnulando(true)
    await supabase.from('pagos').delete().eq('id', pago.id)
    await supabase.from('cuotas').update({
      estado: 'pendiente',
      total_cobrado: 0,
      importe_pagado: 0,
      interes_mora: 0,
      fecha_pago: null
    }).eq('id', pago.cuota_id)
    const { data: todasCuotas } = await supabase.from('cuotas').select('*').eq('credito_id', id)
    const nuevoEstado = calcularEstadoCredito(todasCuotas || [], 'activo')
    await supabase.from('creditos').update({ estado: nuevoEstado }).eq('id', id)
    setConfirmAnular(null)
    setAnulando(false)
    cargar()
  }

  async function borrarCredito() {
    setBorrando(true)
    // Borrar pagos primero (no tienen cascade)
    await supabase.from('pagos').delete().eq('credito_id', id)
    // Borrar cuotas
    await supabase.from('cuotas').delete().eq('credito_id', id)
    // Borrar crédito
    await supabase.from('creditos').delete().eq('id', id)
    navigate('/creditos')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48"><div className="text-gray-400">Cargando...</div></div>
  )
  if (!credito) return <div className="text-center py-12 text-gray-400">Crédito no encontrado</div>

  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada').length
  const saldoPendiente = cuotas
    .filter(c => c.estado !== 'pagada')
    .reduce((s, c) => s + Number(c.importe_original) - Number(c.importe_pagado || 0), 0)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/creditos" className="text-gray-400 hover:text-gray-600 text-sm">← Créditos</Link>
        <Link to={`/clientes/${credito.cliente_id}`} className="text-blue-600 hover:underline text-sm">
          Ver ficha del cliente
        </Link>
      </div>

      {/* Encabezado */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xl font-bold text-blue-700">{credito.numero_credito}</span>
              <span className={ESTADO_BADGE[credito.estado] || 'badge-activo'}>
                {ESTADO_LABEL[credito.estado] || credito.estado}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                credito.tipo === 'hogar' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {credito.tipo === 'hogar' ? 'Hogar' : 'Efectivo'}
              </span>
            </div>
            <div className="text-lg font-semibold text-gray-800">
              {credito.clientes?.apellido}, {credito.clientes?.nombre}
            </div>
            <div className="text-sm text-gray-500">{credito.clientes?.codigo} · {credito.clientes?.domicilio}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => imprimirDoc('tarjeta')} className="btn-secondary text-sm">
              Imprimir tarjeta
            </button>
            <button onClick={() => imprimirDoc('estado')} className="btn-secondary text-sm">
              Imprimir estado de cuenta
            </button>
            <a href="/Pagare.pdf" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
              Imprimir pagaré
            </a>
            <a href="/contrato.pdf" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
              Imprimir contrato
            </a>
            <Link to={`/cobros?cliente=${credito.cliente_id}`} className="btn-primary text-sm">
              Ir a cobrar
            </Link>
            <button onClick={() => setConfirmBorrar(true)} className="btn-danger text-sm">
              Borrar crédito
            </button>
          </div>
        </div>

        {/* Info crédito */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500">Importe original</div>
            <div className="font-bold">{formatMoneda(credito.importe_original)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total con intereses</div>
            <div className="font-bold">{formatMoneda(credito.total_con_intereses)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Cuota {credito.periodicidad}</div>
            <div className="font-bold text-blue-800">{formatMoneda(credito.importe_cuota)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Cuotas</div>
            <div className="font-bold">{cuotasPagadas}/{credito.cantidad_cuotas}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Tasa</div>
            <div className="font-bold">{credito.tasa_interes_porcentaje}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">TEA</div>
            <div className="font-bold">{credito.tasa_efectiva_anual?.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">CFT</div>
            <div className="font-bold">{credito.costo_financiero_total?.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Saldo pendiente</div>
            <div className={`font-bold ${saldoPendiente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatMoneda(Math.max(0, saldoPendiente))}
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progreso de pagos</span>
            <span>{Math.round((cuotasPagadas / credito.cantidad_cuotas) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(cuotasPagadas / credito.cantidad_cuotas) * 100}%` }}
            />
          </div>
        </div>

        {credito.cobrador || credito.vendedor || credito.observaciones ? (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex gap-4 flex-wrap">
            {credito.cobrador && <span>Cobrador: <strong>{credito.cobrador}</strong></span>}
            {credito.vendedor && <span>Vendedor: <strong>{credito.vendedor}</strong></span>}
            {credito.observaciones && <span>Obs: {credito.observaciones}</span>}
          </div>
        ) : null}
      </div>

      {/* Tabla de cuotas */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Detalle de cuotas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">N°</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Importe</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Mora</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Total cobrado</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha pago</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map(cuota => {
                const mora = cuota.estado !== 'pagada'
                  ? calcularMora(cuota.importe_original, cuota.fecha_vencimiento, config.mora?.tasa_diaria)
                  : { dias: 0, mora: 0 }
                return (
                  <tr key={cuota.id} className={`border-b border-gray-100 ${cuota.estado === 'pagada' ? 'opacity-60' : ''}`}>
                    <td className="py-2 px-2 font-medium">{cuota.numero_cuota}</td>
                    <td className="py-2 px-2">{formatFecha(cuota.fecha_vencimiento)}</td>
                    <td className="py-2 px-2 text-right">{formatMoneda(cuota.importe_original)}</td>
                    <td className="py-2 px-2 text-right text-orange-600">
                      {mora.mora > 0 ? formatMoneda(mora.mora) : '-'}
                      {mora.dias > 0 && <div className="text-xs text-gray-400">{mora.dias} días</div>}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {cuota.total_cobrado > 0 ? formatMoneda(cuota.total_cobrado) : '-'}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{formatFecha(cuota.fecha_pago)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CUOTA_BADGE[cuota.estado] || ''}`}>
                        {cuota.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de pagos */}
      {pagos.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Historial de cobros</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Fecha</th>
                <th className="text-right py-2 text-gray-500 font-medium">Cuota</th>
                <th className="text-right py-2 text-gray-500 font-medium">Mora</th>
                <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                <th className="text-left py-2 text-gray-500 font-medium">Cobrador</th>
                {isAdmin && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2">{formatFecha(p.fecha_pago)}</td>
                  <td className="py-2 text-right">{formatMoneda(p.importe_cuota)}</td>
                  <td className="py-2 text-right text-orange-600">
                    {p.interes_mora > 0 ? formatMoneda(p.interes_mora) : '-'}
                  </td>
                  <td className="py-2 text-right font-semibold">{formatMoneda(p.total_cobrado)}</td>
                  <td className="py-2 text-gray-500 text-xs">{p.cobrador || '-'}</td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => setConfirmAnular(p)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Anular
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Docs ocultos para imprimir */}
      {docActivo === 'tarjeta' && (
        <div className="print-only">
          <TarjetaCuotasDoc credito={credito} cliente={credito.clientes} cuotas={cuotas} config={config} />
        </div>
      )}
      {docActivo === 'pagare' && (
        <div className="print-only">
          <PagareDoc credito={credito} cliente={credito.clientes} config={config} />
        </div>
      )}
      {docActivo === 'estado' && (
        <div className="print-only text-sm">
          <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            {/* Encabezado */}
            <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>ESTADO DE CUENTA</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>{config?.empresa?.nombre || 'POWERCRED'}</div>
            </div>
            {/* Datos del crédito */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '14px', fontSize: '12px' }}>
              <div><strong>Cliente:</strong> {credito.clientes?.apellido}, {credito.clientes?.nombre}</div>
              <div><strong>Crédito:</strong> {credito.numero_credito}</div>
              <div><strong>DNI:</strong> {credito.clientes?.dni}</div>
              <div><strong>Estado:</strong> {ESTADO_LABEL[credito.estado] || credito.estado}</div>
              <div><strong>Importe original:</strong> {formatMoneda(credito.importe_original)}</div>
              <div><strong>Total con intereses:</strong> {formatMoneda(credito.total_con_intereses)}</div>
              <div><strong>Cuota {credito.periodicidad}:</strong> {formatMoneda(credito.importe_cuota)}</div>
              <div><strong>Cuotas:</strong> {cuotasPagadas}/{credito.cantidad_cuotas}</div>
              <div><strong>Tasa:</strong> {credito.tasa_interes_porcentaje}%</div>
              <div><strong>Saldo pendiente:</strong> {formatMoneda(Math.max(0, saldoPendiente))}</div>
            </div>
            {/* Tabla cuotas */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px' }}>DETALLE DE CUOTAS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>N°</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Vencimiento</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Importe</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Punitorios</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Total cobrado</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Fecha pago</th>
                    <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map(c => {
                    const moraImpresa = c.estado === 'pagada'
                      ? (c.interes_mora > 0 ? formatMoneda(c.interes_mora) : '-')
                      : (() => { const m = calcularMora(c.importe_original, c.fecha_vencimiento, config.mora?.tasa_diaria); return m.mora > 0 ? formatMoneda(m.mora) : '-' })()
                    return (
                    <tr key={c.id}>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{c.numero_cuota}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{formatFecha(c.fecha_vencimiento)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>{formatMoneda(c.importe_original)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right', color: '#c2410c' }}>{moraImpresa}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>{c.total_cobrado > 0 ? formatMoneda(c.total_cobrado) : '-'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{formatFecha(c.fecha_pago) || '-'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{c.estado}</td>
                    </tr>
                  )})}

                </tbody>
              </table>
            </div>
            {/* Historial de cobros */}
            {pagos.length > 0 && (
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px' }}>HISTORIAL DE COBROS</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Fecha</th>
                      <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Cuota</th>
                      <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Mora</th>
                      <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>Total</th>
                      <th style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id}>
                        <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{formatFecha(p.fecha_pago)}</td>
                        <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>{formatMoneda(p.importe_cuota)}</td>
                        <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>{p.interes_mora > 0 ? formatMoneda(p.interes_mora) : '-'}</td>
                        <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'right' }}>{formatMoneda(p.total_cobrado)}</td>
                        <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>{p.metodo_pago || 'efectivo'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmar anular cobro */}
      {confirmAnular && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-bold text-gray-900 text-lg mb-2 text-center">¿Anular este cobro?</h3>
            <p className="text-sm text-gray-600 mb-1 text-center">
              Fecha: <strong>{formatFecha(confirmAnular.fecha_pago)}</strong> — Total: <strong>{formatMoneda(confirmAnular.total_cobrado)}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4 text-center">
              La cuota vuelve a quedar pendiente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => anularCobro(confirmAnular)}
                disabled={anulando}
                className="btn-danger flex-1"
              >
                {anulando ? 'Anulando...' : 'Sí, anular'}
              </button>
              <button
                onClick={() => setConfirmAnular(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar borrar */}
      {confirmBorrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="text-red-600 text-4xl text-center mb-3">⚠️</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2 text-center">¿Borrar este crédito?</h3>
            <p className="text-sm text-gray-600 mb-1 text-center">
              <strong>{credito.numero_credito}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4 text-center">
              Se borrarán todas las cuotas y el historial de cobros. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={borrarCredito}
                disabled={borrando}
                className="btn-danger flex-1"
              >
                {borrando ? 'Borrando...' : 'Sí, borrar'}
              </button>
              <button
                onClick={() => setConfirmBorrar(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
