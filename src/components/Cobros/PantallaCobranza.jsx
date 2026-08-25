import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'
import { calcularMora, calcularEstadoCredito } from '../../lib/calculos'
import { useConfig } from '../../context/ConfigContext'
import { useAuth } from '../../context/AuthContext'
import TarjetaCuota from './TarjetaCuota'
import Recibo from '../Documentos/Recibo'

export default function PantallaCobranza() {
  const [searchParams] = useSearchParams()
  const { config } = useConfig()
  const { isAdmin, userNombre } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  const [creditosConCuotas, setCreditosConCuotas] = useState([])
  const [loading, setLoading] = useState(false)
  const [busquedaError, setBusquedaError] = useState('')
  const [cobrando, setCobrando] = useState(null)
  const [reciboData, setReciboData] = useState(null)
  const [tieneIncobrables, setTieneIncobrables] = useState(false)

  useEffect(() => {
    const clienteId = searchParams.get('cliente')
    if (clienteId) cargarClientePorId(clienteId)
  }, [])

  // Imprimir recibo automáticamente cuando se setea reciboData
  useEffect(() => {
    if (reciboData) {
      setTimeout(() => window.print(), 400)
      setTimeout(() => setReciboData(null), 3000)
    }
  }, [reciboData])

  async function cargarClientePorId(id) {
    const { data } = await supabase.from('clientes').select('*').eq('id', id).single()
    if (data) await seleccionarCliente(data)
  }

  async function buscarCliente() {
    setBusquedaError('')
    setClienteEncontrado(null)
    setCreditosConCuotas([])
    setResultadosBusqueda([])
    if (!busqueda.trim()) return
    setLoading(true)
    const q = busqueda.trim()
    let clienteQuery = supabase
      .from('clientes')
      .select('*')
      .or(`dni.eq.${q},codigo.ilike.${q},nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(10)

    if (isAdmin) {
      clienteQuery = clienteQuery.neq('propietario', 'Carlos')
    } else {
      clienteQuery = clienteQuery.eq('propietario', userNombre)
    }

    const { data } = await clienteQuery
    setLoading(false)
    if (!data || data.length === 0) {
      setBusquedaError('Cliente no encontrado')
      return
    }
    if (data.length === 1) {
      await seleccionarCliente(data[0])
      return
    }
    setResultadosBusqueda(data)
  }

  async function seleccionarCliente(cli) {
    setLoading(true)
    setResultadosBusqueda([])
    setClienteEncontrado(cli)
    setTieneIncobrables(false)
    const { data: incobrables } = await supabase
      .from('creditos')
      .select('id')
      .eq('cliente_id', cli.id)
      .eq('estado', 'incobrable')
    if (incobrables && incobrables.length > 0) setTieneIncobrables(true)
    const { data: creditos } = await supabase
      .from('creditos')
      .select('*')
      .eq('cliente_id', cli.id)
      .in('estado', ['activo', 'atrasado', 'mora'])
      .order('fecha_inicio')

    const creditosData = []
    for (const cred of (creditos || [])) {
      const { data: cuotas } = await supabase
        .from('cuotas')
        .select('*')
        .eq('credito_id', cred.id)
        .neq('estado', 'pagada')
        .order('numero_cuota')

      const cuotasConMora = (cuotas || []).map(c => {
        const saldoBase = c.importe_original - (c.importe_pagado || 0)
        const mora = calcularMora(saldoBase, c.fecha_vencimiento, config.mora?.tasa_diaria ?? 0.3)
        return { ...c, moraCalculada: mora }
      })

      const { data: todasCuotas } = await supabase.from('cuotas').select('*').eq('credito_id', cred.id)
      const nuevoEstado = calcularEstadoCredito(todasCuotas || [], cred.estado)
      if (nuevoEstado !== cred.estado && nuevoEstado !== 'incobrable') {
        await supabase.from('creditos').update({ estado: nuevoEstado }).eq('id', cred.id)
      }

      creditosData.push({ ...cred, cuotas: cuotasConMora })
    }
    setCreditosConCuotas(creditosData)
    setLoading(false)
  }

  async function cobrarCuota(cuota, credito, metodoPago, montoPago) {
    setCobrando(cuota.id)
    const hoy = hoyArgentina()
    const mora = cuota.moraCalculada
    const esPagoCompleto = montoPago >= mora.total

    // Allocate: first to mora, then to principal
    const moraPagada = Math.round(Math.min(montoPago, mora.mora) * 100) / 100
    const capitalPagado = Math.round(Math.max(0, montoPago - mora.mora) * 100) / 100
    const nuevoImportePagado = Math.round(((cuota.importe_pagado || 0) + capitalPagado) * 100) / 100
    const nuevoTotalCobrado = Math.round(((cuota.total_cobrado || 0) + montoPago) * 100) / 100

    if (esPagoCompleto) {
      await supabase.from('cuotas').update({
        estado: 'pagada',
        importe_pagado: cuota.importe_original,
        interes_mora: (cuota.interes_mora || 0) + moraPagada,
        total_cobrado: nuevoTotalCobrado,
        fecha_pago: hoy
      }).eq('id', cuota.id)
    } else {
      const capitalCompleto = nuevoImportePagado >= cuota.importe_original
      const updateParcial = {
        importe_pagado: capitalCompleto ? cuota.importe_original : nuevoImportePagado,
        interes_mora: (cuota.interes_mora || 0) + moraPagada,
        total_cobrado: nuevoTotalCobrado
      }
      if (capitalCompleto) {
        updateParcial.estado = 'pagada'
        updateParcial.fecha_pago = hoy
      }
      await supabase.from('cuotas').update(updateParcial).eq('id', cuota.id)
    }

    const pagoPayload = {
      cuota_id: cuota.id,
      credito_id: credito.id,
      cliente_id: clienteEncontrado.id,
      fecha_pago: hoy,
      importe_cuota: capitalPagado,
      dias_atraso: mora.dias ?? 0,
      interes_mora: moraPagada,
      total_cobrado: montoPago,
      cobrador: credito.cobrador || '',
      metodo_pago: metodoPago
    }
    const { error: pagoErr } = await supabase.from('pagos').insert(pagoPayload)
    if (pagoErr) {
      alert('Error al registrar el pago: ' + pagoErr.message)
      setCobrando(null)
      return
    }

    const { data: todasCuotas } = await supabase.from('cuotas').select('*').eq('credito_id', credito.id)
    const nuevoEstado = calcularEstadoCredito(todasCuotas || [], credito.estado)
    await supabase.from('creditos').update({ estado: nuevoEstado }).eq('id', credito.id)

    setCobrando(null)

    // Preparar datos para imprimir recibo
    setReciboData({
      pago: { ...pagoPayload },
      cuota,
      credito,
      cliente: clienteEncontrado
    })

    await seleccionarCliente(clienteEncontrado)
  }

  return (
    <div className="space-y-5">
      {/* Recibo oculto para imprimir */}
      {reciboData && (
        <div className="print-only">
          <Recibo
            pago={reciboData.pago}
            cuota={reciboData.cuota}
            credito={reciboData.credito}
            cliente={reciboData.cliente}
            config={config}
          />
        </div>
      )}

      {/* Buscador */}
      <div className="card">
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Buscar cliente por DNI, código CLI-XXXX o nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarCliente()}
          />
          <button onClick={buscarCliente} className="btn-primary px-6">
            {loading ? '...' : 'Buscar'}
          </button>
        </div>
        {busquedaError && <p className="text-sm text-red-600 mt-2">{busquedaError}</p>}
      </div>

      {/* Varios resultados: elegir cuál */}
      {resultadosBusqueda.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
            {resultadosBusqueda.length} clientes encontrados · elegí uno
          </div>
          {resultadosBusqueda.map(cli => (
            <button
              key={cli.id}
              onClick={() => seleccionarCliente(cli)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-orange-50 text-left transition-colors"
            >
              <div>
                <div className="font-semibold text-gray-800">{cli.apellido}, {cli.nombre}</div>
                <div className="text-xs text-gray-400">{cli.codigo} · DNI: {cli.dni}</div>
              </div>
              <span className="text-orange-600 text-sm">Elegir →</span>
            </button>
          ))}
        </div>
      )}

      {/* Datos del cliente */}
      {clienteEncontrado && (
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-orange-900 text-lg">
                {clienteEncontrado.apellido}, {clienteEncontrado.nombre}
              </div>
              <div className="text-sm text-orange-700">
                {clienteEncontrado.codigo} · DNI: {clienteEncontrado.dni} · {clienteEncontrado.celular}
              </div>
            </div>
            <Link to={`/clientes/${clienteEncontrado.id}`} className="text-orange-600 hover:underline text-sm">
              Ver ficha →
            </Link>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-400">Cargando...</div>}

      {tieneIncobrables && clienteEncontrado && !loading && (
        <div className="card text-center py-8 border-red-200 bg-red-50">
          <div className="text-red-600 text-lg font-semibold mb-1">⚠ Crédito derivado a asesor legal</div>
          <div className="text-red-500 text-sm">Este cliente tiene un crédito incobrable. No se puede registrar cobros desde el sistema.</div>
        </div>
      )}
      {creditosConCuotas.length === 0 && clienteEncontrado && !loading && !tieneIncobrables && (
        <div className="card text-center py-8">
          <div className="text-green-600 text-lg font-semibold mb-1">¡Todas las cuotas al día!</div>
          <div className="text-gray-400 text-sm">Este cliente no tiene cuotas pendientes de cobro.</div>
        </div>
      )}

      {/* Resumen de todos los créditos, cuando hay más de uno */}
      {creditosConCuotas.length > 1 && !loading && (
        <div className="card bg-red-50 border-red-200">
          <div className="font-bold text-red-800 mb-2">
            ⚠ Este cliente tiene {creditosConCuotas.length} créditos activos
          </div>
          <div className="flex flex-wrap gap-2">
            {creditosConCuotas.map(credito => (
              <button
                key={credito.id}
                onClick={() => document.getElementById(`credito-${credito.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
              >
                {credito.numero_credito} ({credito.cuotas.length} cuota{credito.cuotas.length !== 1 ? 's' : ''}) →
              </button>
            ))}
          </div>
        </div>
      )}

      {creditosConCuotas.map(credito => (
        <div key={credito.id} id={`credito-${credito.id}`} className="card scroll-mt-4">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div>
              <span className="font-mono font-bold text-orange-700">{credito.numero_credito}</span>
              <span className="ml-3 text-sm text-gray-500">
                {credito.tipo === 'hogar' ? 'Crédito del Hogar' : 'Préstamo en Efectivo'} ·{' '}
                {credito.cantidad_cuotas} cuotas {credito.periodicidad}es
              </span>
            </div>
            <Link to={`/creditos/${credito.id}`} className="text-orange-600 hover:underline text-xs">
              Ver detalle
            </Link>
          </div>

          <div className="space-y-3">
            {credito.cuotas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No hay cuotas pendientes</p>
            ) : (
              credito.cuotas.map(cuota => (
                <TarjetaCuota
                  key={cuota.id}
                  cuota={cuota}
                  credito={credito}
                  onCobrar={(metodo, monto) => cobrarCuota(cuota, credito, metodo, monto)}
                  cobrando={cobrando === cuota.id}
                  exitoId={reciboData?.cuota?.id}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
