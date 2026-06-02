import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConfig } from '../../context/ConfigContext'
import {
  calcularCuota, calcularTEA, calcularCFT, calcularPrimerVencimiento,
  generarFechasVencimiento, calcularCapacidadDisponible
} from '../../lib/calculos'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'
import TarjetaCuotasDoc from '../Documentos/TarjetaCuotas'
import PagareDoc from '../Documentos/Pagare'

const CUOTAS_MENSUAL = [3, 6, 9, 12]
const CUOTAS_QUINCENAL = [4, 6, 8, 10, 12]
const CUOTAS_SEMANAL = [4, 8, 12, 16, 20, 24]

export default function NuevoCredito() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { config, getTasa } = useConfig()
  const printRef = useRef()

  // Paso: 1=buscar cliente, 2=cargar crédito, 3=documentos
  const [paso, setPaso] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  const [creditosActivos, setCreditosActivos] = useState([])
  const [busquedaError, setBusquedaError] = useState('')

  const [tipo, setTipo] = useState('hogar')
  const [periodicidad, setPeriodicidad] = useState('mensual')
  const [cantCuotas, setCantCuotas] = useState(null)
  const [importe, setImporte] = useState('')
  const [fechaInicio, setFechaInicio] = useState(hoyArgentina())
  const [primerVenc, setPrimerVenc] = useState('')
  const [cobrador, setCobrador] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [creditoGuardado, setCreditoGuardado] = useState(null)
  const [cuotasGuardadas, setCuotasGuardadas] = useState([])
  const [docActivo, setDocActivo] = useState(null)
  const [advertenciaCapacidad, setAdvertenciaCapacidad] = useState(false)
  const [rubro, setRubro] = useState('general')
  const [modoPersonalizado, setModoPersonalizado] = useState(false)
  const [cuotasPersonalizada, setCuotasPersonalizada] = useState('')
  const [tasaPersonalizada, setTasaPersonalizada] = useState('')
  const [periodicidadPersonalizada, setPeriodicidadPersonalizada] = useState('mensual')

  useEffect(() => {
    const clienteId = searchParams.get('cliente')
    if (clienteId) cargarClientePorId(clienteId)
  }, [])

  useEffect(() => {
    const pEf = modoPersonalizado ? periodicidadPersonalizada : periodicidad
    if (fechaInicio && pEf) {
      setPrimerVenc(calcularPrimerVencimiento(fechaInicio, pEf))
    }
  }, [fechaInicio, periodicidad, modoPersonalizado, periodicidadPersonalizada])

  async function cargarClientePorId(id) {
    const { data: cli } = await supabase.from('clientes').select('*').eq('id', id).single()
    if (cli) await seleccionarCliente(cli)
  }

  async function buscarCliente() {
    setBusquedaError('')
    if (!busqueda.trim()) return
    const q = busqueda.trim()
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .or(`dni.eq.${q},codigo.ilike.${q},nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(5)
    if (!data || data.length === 0) {
      setBusquedaError('No se encontró ningún cliente con ese criterio')
      return
    }
    if (data.length === 1) {
      await seleccionarCliente(data[0])
    } else {
      setBusquedaError(`Se encontraron ${data.length} clientes. Buscá por DNI o código para mayor precisión.`)
    }
  }

  async function seleccionarCliente(cli) {
    const { data: creds } = await supabase
      .from('creditos')
      .select('*')
      .eq('cliente_id', cli.id)
      .in('estado', ['activo', 'atrasado', 'mora'])
    setClienteEncontrado(cli)
    setCreditosActivos(creds || [])
    setPaso(2)
  }

  // Valores efectivos según modo (estándar o personalizado)
  const periodicidadEfectiva = modoPersonalizado ? periodicidadPersonalizada : periodicidad
  const cantCuotasEfectiva = modoPersonalizado ? (parseInt(cuotasPersonalizada) || null) : cantCuotas

  function getTasaBoton(n) {
    if (tipo === 'hogar' && rubro === 'colchones_sillones') return getTasa('colchones', periodicidad, n)
    return getTasa(tipo, periodicidad, n)
  }

  function getTasaEfectiva() {
    if (modoPersonalizado) return parseFloat(tasaPersonalizada) || 0
    if (tipo === 'hogar' && rubro === 'colchones_sillones') return getTasa('colchones', periodicidadEfectiva, cantCuotasEfectiva)
    return getTasa(tipo, periodicidadEfectiva, cantCuotasEfectiva)
  }

  // Cálculos en tiempo real
  const tasa = cantCuotasEfectiva ? getTasaEfectiva() : 0
  const { total: totalConIntereses, cuota: importeCuota } = importe && cantCuotasEfectiva
    ? calcularCuota(parseFloat(importe), tasa, cantCuotasEfectiva)
    : { total: 0, cuota: 0 }
  const tea = importeCuota && cantCuotasEfectiva
    ? calcularTEA(parseFloat(importe), importeCuota, cantCuotasEfectiva, periodicidadEfectiva)
    : 0
  const cft = calcularCFT(tea)

  const capacidad = clienteEncontrado?.capacidad_pago_mensual
    ? calcularCapacidadDisponible(clienteEncontrado.capacidad_pago_mensual, creditosActivos)
    : null

  const cuotaMensualEquivalente = periodicidadEfectiva === 'mensual' ? importeCuota : periodicidadEfectiva === 'quincenal' ? importeCuota * 2 : importeCuota * 4.33
  const superaCapacidad = capacidad && cuotaMensualEquivalente > capacidad.disponible

  async function guardarCredito() {
    if (!clienteEncontrado || !cantCuotasEfectiva || !importe || !primerVenc) return
    if (superaCapacidad && !advertenciaCapacidad) {
      setAdvertenciaCapacidad(true)
      return
    }
    setGuardando(true)

    // Generar número de crédito
    const { data: ultimo } = await supabase
      .from('creditos')
      .select('numero_credito')
      .order('created_at', { ascending: false })
      .limit(1)
    let siguienteNum = 1
    if (ultimo && ultimo.length > 0) {
      const num = parseInt(ultimo[0].numero_credito.replace('CRED-', ''))
      if (!isNaN(num)) siguienteNum = num + 1
    }
    const numeroCredito = `CRED-${String(siguienteNum).padStart(4, '0')}`

    const credito = {
      numero_credito: numeroCredito,
      cliente_id: clienteEncontrado.id,
      tipo,
      importe_original: parseFloat(importe),
      tasa_interes_porcentaje: tasa,
      tasa_efectiva_anual: tea,
      costo_financiero_total: cft,
      total_con_intereses: totalConIntereses,
      cantidad_cuotas: cantCuotasEfectiva,
      periodicidad: periodicidadEfectiva,
      importe_cuota: importeCuota,
      fecha_inicio: fechaInicio,
      fecha_primer_vencimiento: primerVenc,
      estado: 'activo',
      vendedor: vendedor || null,
      cobrador: cobrador || null,
      observaciones: observaciones || null
    }

    const { data: credData, error } = await supabase
      .from('creditos')
      .insert(credito)
      .select()
      .single()

    if (error) {
      alert('Error al guardar el crédito: ' + error.message)
      setGuardando(false)
      return
    }

    // Generar cuotas
    const fechas = generarFechasVencimiento(primerVenc, cantCuotasEfectiva, periodicidadEfectiva)
    const cuotas = fechas.map((fecha, i) => ({
      credito_id: credData.id,
      numero_cuota: i + 1,
      fecha_vencimiento: fecha,
      importe_original: importeCuota,
      importe_pagado: 0,
      interes_mora: 0,
      total_cobrado: 0,
      estado: 'pendiente'
    }))

    const { data: cuotasData } = await supabase.from('cuotas').insert(cuotas).select()

    setCreditoGuardado({ ...credData, clientes: clienteEncontrado })
    setCuotasGuardadas(cuotasData || cuotas)
    setGuardando(false)
    setPaso(3)
  }

  function imprimir(doc) {
    setDocActivo(doc)
    setTimeout(() => window.print(), 300)
  }

  const cuotasOpciones = periodicidad === 'mensual' ? CUOTAS_MENSUAL : periodicidad === 'quincenal' ? CUOTAS_QUINCENAL : CUOTAS_SEMANAL

  // ── PASO 1: Buscar cliente ──────────────────────────────
  if (paso === 1) return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-700 mb-6">Nuevo Crédito · Paso 1 de 2</h2>
      <div className="card">
        <h3 className="font-semibold mb-4">Buscar Cliente</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ingresá el DNI, código CLI-XXXX o nombre del cliente.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="DNI, CLI-0001, nombre o apellido..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarCliente()}
          />
          <button onClick={buscarCliente} className="btn-primary px-5">
            Buscar
          </button>
        </div>
        {busquedaError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {busquedaError}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-400">
          ¿Cliente nuevo?{' '}
          <a href="/clientes/nuevo" className="text-blue-600 hover:underline">
            Crear cliente primero
          </a>
        </div>
      </div>
    </div>
  )

  // ── PASO 3: Documentos ──────────────────────────────────
  if (paso === 3 && creditoGuardado) return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="card text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Crédito creado exitosamente</h3>
        <p className="text-gray-500 text-sm mt-1">
          {creditoGuardado.numero_credito} · {clienteEncontrado?.apellido}, {clienteEncontrado?.nombre}
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Documentos para imprimir</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => imprimir('tarjeta')}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors"
          >
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-medium text-sm">Tarjeta de Cuotas</span>
            <span className="text-xs text-gray-400">Para el cliente</span>
          </button>
          <button
            onClick={() => window.open('/Pagare.pdf', '_blank')}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors"
          >
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-medium text-sm">Pagaré</span>
            <span className="text-xs text-gray-400">En PDF</span>
          </button>
          <button
            onClick={() => window.open('/contrato.pdf', '_blank')}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors"
          >
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-sm">Contrato</span>
            <span className="text-xs text-gray-400">En PDF</span>
          </button>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={() => navigate(`/creditos/${creditoGuardado.id}`)} className="btn-primary flex-1">
            Ver crédito
          </button>
          <button onClick={() => navigate('/creditos/nuevo')} className="btn-secondary flex-1">
            Nuevo crédito
          </button>
        </div>
      </div>

      {/* Documentos ocultos para impresión */}
      {docActivo === 'tarjeta' && (
        <div className="print-only">
          <TarjetaCuotasDoc
            credito={creditoGuardado}
            cliente={clienteEncontrado}
            cuotas={cuotasGuardadas}
            config={config}
          />
        </div>
      )}
      {docActivo === 'pagare' && (
        <div className="print-only">
          <PagareDoc
            credito={creditoGuardado}
            cliente={clienteEncontrado}
            config={config}
          />
        </div>
      )}
    </div>
  )

  // ── PASO 2: Cargar crédito ──────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setPaso(1)} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Cambiar cliente
        </button>
        <h2 className="text-lg font-semibold text-gray-700">Nuevo Crédito · Paso 2 de 2</h2>
      </div>

      {/* Resumen cliente */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-blue-900">
              {clienteEncontrado?.apellido}, {clienteEncontrado?.nombre}
            </div>
            <div className="text-sm text-blue-600">
              {clienteEncontrado?.codigo} · DNI: {clienteEncontrado?.dni}
            </div>
            <div className="text-xs text-blue-500 mt-0.5">
              {creditosActivos.length} crédito(s) activo(s)
            </div>
          </div>
          {capacidad && (
            <div className="text-right text-sm">
              <div className="text-blue-600 text-xs">Capacidad disponible</div>
              <div className={`font-bold text-lg ${capacidad.disponible < 0 ? 'text-red-600' : 'text-blue-800'}`}>
                {formatMoneda(capacidad.disponible)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advertencia capacidad */}
      {superaCapacidad && advertenciaCapacidad && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 text-sm text-orange-800">
          <strong>Advertencia:</strong> Este crédito supera la capacidad de pago disponible del cliente (
          {formatMoneda(cuotaMensualEquivalente)} vs {formatMoneda(capacidad?.disponible)}).
          Podés continuar de todas formas si ya verificaste con el cliente.
        </div>
      )}

      <div className="card space-y-6">
        {/* Tipo de crédito */}
        <div>
          <label className="label mb-2">Tipo de crédito</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setTipo('hogar'); setCantCuotas(null); setModoPersonalizado(false) }}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                tipo === 'hogar' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">🏠 Crédito del Hogar</div>
              <div className="text-xs text-gray-500 mt-1">Financiación de productos del hogar</div>
            </button>
            <button
              type="button"
              onClick={() => { setTipo('efectivo'); setCantCuotas(null); setRubro('general'); setModoPersonalizado(false) }}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                tipo === 'efectivo' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">💵 Préstamo en Efectivo</div>
              <div className="text-xs text-gray-500 mt-1">Dinero en efectivo (tasa diferenciada)</div>
            </button>
          </div>
        </div>

        {/* Rubro (solo para crédito del hogar) */}
        {tipo === 'hogar' && (
          <div>
            <label className="label mb-2">Rubro</label>
            <div className="flex gap-3 flex-wrap">
              {[
                { id: 'general', label: 'General', desc: 'Tasas estándar del sistema' },
                { id: 'colchones_sillones', label: 'Colchones y Sillones', desc: '3 y 6 cuotas sin interés' },
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setRubro(r.id); setCantCuotas(null) }}
                  className={`px-4 py-2.5 rounded-xl border-2 text-left transition-colors ${
                    rubro === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">{r.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Importe */}
        <div>
          <label className="label">Importe a financiar *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
            <input
              type="number"
              className="input-field pl-7 text-lg font-semibold"
              placeholder="0,00"
              value={importe}
              onChange={e => setImporte(e.target.value)}
              min="0" step="0.01"
            />
          </div>
        </div>

        {/* Periodicidad (oculta en modo personalizado) */}
        {!modoPersonalizado && (
          <div>
            <label className="label mb-2">Periodicidad</label>
            <div className="flex gap-3">
              {['mensual', 'quincenal', 'semanal'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPeriodicidad(p); setCantCuotas(null) }}
                  className={`px-6 py-2 rounded-lg border-2 font-medium transition-colors capitalize ${
                    periodicidad === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Plan de cuotas */}
        <div>
          <label className="label mb-2">Plan de cuotas</label>
          {!modoPersonalizado ? (
            <div className="flex flex-wrap gap-2">
              {cuotasOpciones.map(n => {
                const tasaOpcion = getTasaBoton(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCantCuotas(n)}
                    className={`px-4 py-3 rounded-xl border-2 text-center transition-colors min-w-20 ${
                      cantCuotas === n ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{n}</div>
                    <div className="text-xs text-gray-400">{tasaOpcion}%</div>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => { setModoPersonalizado(true); setCantCuotas(null) }}
                className="px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-center hover:border-orange-400 hover:bg-orange-50 transition-colors min-w-20"
              >
                <div className="text-sm text-gray-500">✏️</div>
                <div className="text-xs text-gray-400">Personalizada</div>
              </button>
            </div>
          ) : (
            <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-orange-800 text-sm">Plan Personalizado</span>
                <button
                  type="button"
                  onClick={() => { setModoPersonalizado(false); setCuotasPersonalizada(''); setTasaPersonalizada('') }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  ← Volver a planes estándar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs">Periodicidad</label>
                  <select
                    className="input-field text-sm"
                    value={periodicidadPersonalizada}
                    onChange={e => setPeriodicidadPersonalizada(e.target.value)}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">N° de cuotas</label>
                  <input
                    type="number"
                    className="input-field text-sm"
                    placeholder="Ej: 10"
                    value={cuotasPersonalizada}
                    onChange={e => setCuotasPersonalizada(e.target.value)}
                    min="1" max="120"
                  />
                </div>
                <div>
                  <label className="label text-xs">Tasa total (%)</label>
                  <input
                    type="number"
                    className="input-field text-sm"
                    placeholder="Ej: 30"
                    value={tasaPersonalizada}
                    onChange={e => setTasaPersonalizada(e.target.value)}
                    min="0" step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cálculo automático */}
        {importe && cantCuotasEfectiva && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-sm font-semibold text-gray-700 mb-3">Resumen del crédito</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Tasa total</div>
                <div className="font-bold text-gray-900">{tasa}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total con intereses</div>
                <div className="font-bold text-gray-900">{formatMoneda(totalConIntereses)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Importe por cuota</div>
                <div className="font-bold text-2xl text-blue-800">{formatMoneda(importeCuota)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">TEA</div>
                <div className="font-bold text-gray-900">{tea.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">CFT</div>
                <div className="font-bold text-gray-900">{cft.toFixed(2)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de inicio</label>
            <input type="date" className="input-field"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Primer vencimiento</label>
            <input type="date" className="input-field"
              value={primerVenc}
              onChange={e => setPrimerVenc(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">
              Automático según periodicidad (editable)
            </div>
          </div>
        </div>

        {/* Cobrador y vendedor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Cobrador</label>
            <input type="text" className="input-field" placeholder="Opcional"
              value={cobrador} onChange={e => setCobrador(e.target.value)} />
          </div>
          <div>
            <label className="label">Vendedor</label>
            <input type="text" className="input-field" placeholder="Opcional"
              value={vendedor} onChange={e => setVendedor(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Observaciones</label>
          <textarea className="input-field" rows={2} placeholder="Opcional..."
            value={observaciones} onChange={e => setObservaciones(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={guardarCredito}
            disabled={!cantCuotasEfectiva || !importe || !primerVenc || guardando || (modoPersonalizado && (!cuotasPersonalizada || !tasaPersonalizada))}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Crear Crédito'}
          </button>
          <button onClick={() => navigate('/creditos')} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
