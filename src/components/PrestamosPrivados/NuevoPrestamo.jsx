import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calcularPrimerVencimiento, calcularTEA, generarFechasVencimiento } from '../../lib/calculos'
import { formatMoneda, hoyArgentina } from '../../lib/formatters'
import { armarCuotas, interesTotal, mesesDePlazo, resumirCaja } from '../../lib/prestamosPrivados'

const PERSONA_VACIA = { nombre: '', apellido: '', dni: '', celular: '', domicilio: '', localidad: '' }

export default function NuevoPrestamo() {
  const navigate = useNavigate()
  const [prestamistas, setPrestamistas] = useState([])
  const [personas, setPersonas] = useState([])
  const [movimientosCaja, setMovimientosCaja] = useState([])
  const [prestamosCaja, setPrestamosCaja] = useState([])
  const [aportes, setAportes] = useState([{ prestamista_id: '', monto: '' }])
  const [personaId, setPersonaId] = useState('')
  const [nuevoPrestamista, setNuevoPrestamista] = useState('')
  const [creandoPersona, setCreandoPersona] = useState(false)
  const [persona, setPersona] = useState(PERSONA_VACIA)
  const [capital, setCapital] = useState('')
  const [periodicidad, setPeriodicidad] = useState('mensual')
  const [cantCuotas, setCantCuotas] = useState('')
  const [interesMensual, setInteresMensual] = useState('')
  const [tasaMora, setTasaMora] = useState('0')
  const [fechaInicio, setFechaInicio] = useState(hoyArgentina())
  const [primerVenc, setPrimerVenc] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('pp_prestamistas').select('*').order('nombre').then(({ data }) => setPrestamistas(data || []))
    supabase.from('pp_personas').select('*').order('apellido').then(({ data }) => setPersonas(data || []))
    supabase.from('pp_caja_movimientos').select('*').then(({ data }) => setMovimientosCaja(data || []))
    supabase
      .from('pp_prestamos')
      .select('capital, created_at, pp_participaciones(prestamista_id, monto), pp_pagos(importe, mora, created_at)')
      .then(({ data }) => setPrestamosCaja(data || []))
  }, [])

  useEffect(() => {
    if (fechaInicio) setPrimerVenc(calcularPrimerVencimiento(fechaInicio, periodicidad))
  }, [fechaInicio, periodicidad])

  const capitalNum = parseFloat(capital) || 0
  const cuotasNum = parseInt(cantCuotas) || 0
  const tasaNum = interesTotal(parseFloat(interesMensual), cuotasNum, periodicidad)
  const planCompleto = capitalNum > 0 && cuotasNum > 0 && tasaNum >= 0 && !!primerVenc
  const plan = planCompleto
    ? armarCuotas(capitalNum, tasaNum, generarFechasVencimiento(primerVenc, cuotasNum, periodicidad))
    : null
  const tea = plan ? calcularTEA(capitalNum, plan.importeCuota, cuotasNum, periodicidad) : 0
  // Con un solo prestador pone todo el capital; con varios, cada uno su monto
  const montoDe = aporte => (aportes.length === 1 ? capitalNum : parseFloat(aporte.monto) || 0)
  const sumaAportes = aportes.reduce((s, a) => s + montoDe(a), 0)
  const diferencia = Math.round((capitalNum - sumaAportes) * 100) / 100

  function cambiarAporte(i, campo, valor) {
    setAportes(prev => prev.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)))
  }

  async function agregarPrestamista() {
    const nombre = nuevoPrestamista.trim()
    if (!nombre) return
    const { data, error: e } = await supabase.from('pp_prestamistas').insert({ nombre }).select().single()
    if (e) {
      setError('No se pudo agregar esa persona. Puede que ya exista.')
      return
    }
    setPrestamistas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setAportes(prev => {
      const vacio = prev.findIndex(a => !a.prestamista_id)
      if (vacio === -1) return [...prev, { prestamista_id: data.id, monto: '' }]
      return prev.map((a, j) => (j === vacio ? { ...a, prestamista_id: data.id } : a))
    })
    setNuevoPrestamista('')
  }

  async function guardar() {
    setError('')
    if (aportes.some(a => !a.prestamista_id)) return setError('Elegí quién presta la plata.')
    if (new Set(aportes.map(a => a.prestamista_id)).size !== aportes.length) return setError('Hay un prestador repetido.')
    if (!plan) return setError('Completá capital, cuotas, tasa y primer vencimiento.')
    if (aportes.some(a => !(montoDe(a) > 0)) || Math.abs(diferencia) > 0.01) {
      return setError('Lo que pone cada prestador tiene que sumar el capital del préstamo.')
    }
    if (creandoPersona ? !persona.nombre.trim() || !persona.apellido.trim() : !personaId) {
      return setError('Elegí a quién se le presta, o cargá nombre y apellido.')
    }

    setGuardando(true)
    let idPersona = personaId
    if (creandoPersona) {
      const { data, error: e } = await supabase.from('pp_personas').insert(persona).select().single()
      if (e) {
        setError('No se pudo guardar la persona.')
        setGuardando(false)
        return
      }
      idPersona = data.id
    }

    const { data: id, error: e } = await supabase.rpc('pp_crear_prestamo', {
      p_prestamo: {
        participaciones: aportes.map(a => ({ prestamista_id: a.prestamista_id, monto: montoDe(a) })),
        persona_id: idPersona,
        capital: capitalNum,
        tasa_interes_porcentaje: tasaNum,
        tasa_efectiva_anual: tea,
        total_con_intereses: plan.total,
        cantidad_cuotas: cuotasNum,
        periodicidad,
        importe_cuota: plan.importeCuota,
        tasa_mora_diaria: parseFloat(tasaMora) || 0,
        fecha_inicio: fechaInicio,
        fecha_primer_vencimiento: primerVenc,
        observaciones: observaciones.trim(),
      },
      p_cuotas: plan.cuotas,
    })
    setGuardando(false)
    if (e) {
      setError('No se pudo guardar el préstamo: ' + e.message)
      return
    }
    navigate(`/prestamos-privados/${id}`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card space-y-6">
        <div>
          <label className="label">Quién presta *</label>
          <div className="space-y-3">
            {aportes.map((aporte, i) => {
              const caja = aporte.prestamista_id ? resumirCaja(movimientosCaja, prestamosCaja, aporte.prestamista_id) : null
              const supera = caja && montoDe(aporte) > caja.disponible
              return (
                <div key={i}>
                  <div className="flex gap-2">
                    <select className="input-field flex-1" value={aporte.prestamista_id}
                      onChange={e => cambiarAporte(i, 'prestamista_id', e.target.value)}>
                      <option value="">Elegir...</option>
                      {prestamistas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {aportes.length > 1 && (
                      <>
                        <input type="number" className="input-field w-40" placeholder="Cuánto pone" min="0" step="0.01"
                          value={aporte.monto} onChange={e => cambiarAporte(i, 'monto', e.target.value)} />
                        <button type="button" onClick={() => setAportes(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 px-2">✕</button>
                      </>
                    )}
                  </div>
                  {caja && (
                    <div className={`text-sm mt-1 ${supera ? 'text-red-600' : 'text-green-700'}`}>
                      Disponible para prestar: <strong>{formatMoneda(caja.disponible)}</strong>
                      {supera && ' — lo que pone supera lo disponible'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <button type="button" onClick={() => setAportes(prev => [...prev, { prestamista_id: '', monto: '' }])}
              className="text-sm text-blue-600 hover:underline">
              + Prestan entre varios
            </button>
            {aportes.length > 1 && capitalNum > 0 && (
              <span className={`text-sm ${Math.abs(diferencia) <= 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                {Math.abs(diferencia) <= 0.01
                  ? 'Los montos suman el capital'
                  : diferencia > 0 ? `Faltan ${formatMoneda(diferencia)} para llegar al capital` : `Sobran ${formatMoneda(-diferencia)}`}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Agregar otra persona"
              value={nuevoPrestamista}
              onChange={e => setNuevoPrestamista(e.target.value)}
            />
            <button type="button" onClick={agregarPrestamista} className="btn-secondary whitespace-nowrap">Agregar</button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">A quién se le presta *</label>
            <button type="button" onClick={() => setCreandoPersona(v => !v)} className="text-sm text-blue-600 hover:underline">
              {creandoPersona ? 'Elegir una existente' : '+ Persona nueva'}
            </button>
          </div>
          {creandoPersona ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['nombre', 'Nombre *'], ['apellido', 'Apellido *'], ['dni', 'DNI'],
                ['celular', 'Celular'], ['domicilio', 'Domicilio'], ['localidad', 'Localidad'],
              ].map(([campo, etiqueta]) => (
                <input
                  key={campo}
                  type="text"
                  className="input-field"
                  placeholder={etiqueta}
                  value={persona[campo]}
                  onChange={e => setPersona(prev => ({ ...prev, [campo]: e.target.value }))}
                />
              ))}
            </div>
          ) : (
            <select className="input-field" value={personaId} onChange={e => setPersonaId(e.target.value)}>
              <option value="">Elegir...</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="label">Capital prestado *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
            <input
              type="number"
              className="input-field pl-7 text-lg font-semibold"
              placeholder="0,00"
              value={capital}
              onChange={e => setCapital(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div>
          <label className="label mb-2">Periodicidad</label>
          <div className="flex flex-wrap gap-3">
            {['mensual', 'quincenal', 'semanal'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodicidad(p)}
                className={`px-6 py-2 rounded-lg border-2 font-medium transition-colors capitalize ${
                  periodicidad === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Cantidad de cuotas *</label>
            <input type="number" className="input-field" placeholder="Ej: 6" min="1" max="120"
              value={cantCuotas} onChange={e => setCantCuotas(e.target.value)} />
          </div>
          <div>
            <label className="label">Interés mensual (%) *</label>
            <input type="number" className="input-field" placeholder="Ej: 9" min="0" step="0.1"
              value={interesMensual} onChange={e => setInteresMensual(e.target.value)} />
          </div>
          <div>
            <label className="label">Punitorio diario (%)</label>
            <input type="number" className="input-field" min="0" step="0.1"
              value={tasaMora} onChange={e => setTasaMora(e.target.value)} />
          </div>
        </div>

        {plan && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Importe por cuota</div>
              <div className="font-bold text-2xl text-blue-800">{formatMoneda(plan.importeCuota)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                Interés total ({mesesDePlazo(cuotasNum, periodicidad).toLocaleString('es-AR')} meses)
              </div>
              <div className="font-bold text-2xl text-gray-900">{tasaNum.toLocaleString('es-AR')}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total a cobrar</div>
              <div className="font-bold text-gray-900">{formatMoneda(plan.total)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Interés a ganar</div>
              <div className="font-bold text-green-700">{formatMoneda(plan.total - capitalNum)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">TEA</div>
              <div className="font-bold text-gray-900">{tea.toFixed(2)}%</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha del préstamo</label>
            <input type="date" className="input-field" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Primer vencimiento</label>
            <input type="date" className="input-field" value={primerVenc} onChange={e => setPrimerVenc(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Observaciones</label>
          <textarea className="input-field" rows={2} placeholder="Opcional..."
            value={observaciones} onChange={e => setObservaciones(e.target.value)} />
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <button onClick={guardar} disabled={guardando} className="btn-primary flex-1 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Crear préstamo'}
          </button>
          <button onClick={() => navigate('/prestamos-privados')} className="btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
