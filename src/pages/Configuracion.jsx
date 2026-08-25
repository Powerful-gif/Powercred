import { useState, useEffect } from 'react'
import { useConfig } from '../context/ConfigContext'
import { supabase } from '../lib/supabase'
import { hoyArgentina } from '../lib/formatters'

function idDesdeNombre(nombre) {
  const base = nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return base || `grupo_${Date.now()}`
}

function grupoVacio(nombre) {
  return {
    id: idDesdeNombre(nombre) + '_' + Math.random().toString(36).slice(2, 6),
    nombre,
    esDefault: false,
    rubrosDux: [],
    descuentoEfectivo: 0,
    descuentoTransferencia: 0,
    powercred: {
      mensual: { 3: 0, 6: 0, 9: 0, 12: 0 },
      quincenal: { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0 },
      semanal: { 4: 0, 8: 0, 12: 0, 16: 0, 20: 0, 24: 0 }
    }
  }
}

function grupoTarjetaVacio(nombre) {
  return {
    id: idDesdeNombre(nombre) + '_' + Math.random().toString(36).slice(2, 6),
    nombre,
    esDefault: false,
    rubrosDux: [],
    tarjeta: { 3: 0, 5: 0, 6: 0, 9: 0, 12: 0, 14: 0 }
  }
}

function papelesVacio(nombre) {
  return { id: idDesdeNombre(nombre) + '_' + Math.random().toString(36).slice(2, 6), nombre, costo: 0 }
}

export default function Configuracion() {
  const { config, saveConfig, esCuotaTarjetaNaranja } = useConfig()
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tab, setTab] = useState('negocio')

  // Estado local para edición
  const [negocio, setNegocio] = useState(config.negocio)
  const [pagare, setPagare] = useState(config.pagare)
  const [mora, setMora] = useState(config.mora)
  const [tasas, setTasas] = useState(config.tasas)
  const [grupos, setGrupos] = useState(config.gruposTasa)
  const [gruposTarjeta, setGruposTarjeta] = useState(config.gruposTarjeta)
  const [papeles, setPapeles] = useState(config.papelesOpciones || [])

  const [rubrosDuxDisponibles, setRubrosDuxDisponibles] = useState([])
  const [subRubrosPorRubro, setSubRubrosPorRubro] = useState({})
  const [cargandoRubros, setCargandoRubros] = useState(false)
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState('')
  const [nuevoGrupoTarjetaNombre, setNuevoGrupoTarjetaNombre] = useState('')
  const [nuevoPapelNombre, setNuevoPapelNombre] = useState('')
  const [nuevaCuota, setNuevaCuota] = useState({})
  const [nuevaCuotaNaranja, setNuevaCuotaNaranja] = useState({})

  useEffect(() => {
    if ((tab === 'powercred' || tab === 'tarjeta') && rubrosDuxDisponibles.length === 0) {
      cargarRubrosDux()
    }
  }, [tab])

  async function cargarRubrosDux() {
    setCargandoRubros(true)
    try {
      const r = await fetch('/api/buscar-catalogo?accion=rubros_admin')
      const data = await r.json()
      setRubrosDuxDisponibles(Array.isArray(data?.rubros) ? data.rubros : [])
      setSubRubrosPorRubro(data?.subRubrosPorRubro || {})
    } catch (e) {
      console.error('Error cargando rubros de Dux', e)
    } finally {
      setCargandoRubros(false)
    }
  }

  // Todas las combinaciones "rubro > sub_rubro" disponibles, para el
  // selector de sub-rubros específicos (ej: Movilidad > Motos).
  const subRubrosDisponibles = Object.entries(subRubrosPorRubro)
    .flatMap(([rubro, subs]) => subs.map(sub => ({ rubro, sub, clave: `${rubro}::${sub}` })))

  async function guardar() {
    setGuardando(true)
    await saveConfig({ negocio, pagare, mora, tasas, gruposTasa: grupos, gruposTarjeta, papelesOpciones: papeles })
    setMensaje('Configuración guardada correctamente')
    setGuardando(false)
    setTimeout(() => setMensaje(''), 3000)
  }

  async function exportarBackup() {
    const { data: clientes } = await supabase.from('clientes').select('*')
    const { data: creditos } = await supabase.from('creditos').select('*')
    const { data: cuotas } = await supabase.from('cuotas').select('*')
    const { data: pagos } = await supabase.from('pagos').select('*')

    const backup = {
      version: '1.0',
      fecha: hoyArgentina(),
      clientes: clientes || [],
      creditos: creditos || [],
      cuotas: cuotas || [],
      pagos: pagos || []
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `powercred-backup-${hoyArgentina()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function actualizarTasa(tipo, periodicidad, cuotas, valor) {
    setTasas(prev => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [periodicidad]: {
          ...prev[tipo][periodicidad],
          [cuotas]: Number(valor)
        }
      }
    }))
  }

  // ── Grupos de PowerCred ─────────────────────────────────────
  function agregarGrupo() {
    const nombre = nuevoGrupoNombre.trim()
    if (!nombre) return
    setGrupos(prev => [...prev, grupoVacio(nombre)])
    setNuevoGrupoNombre('')
  }

  function eliminarGrupo(id) {
    setGrupos(prev => prev.filter(g => g.id !== id))
  }

  function renombrarGrupo(id, nombre) {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, nombre } : g))
  }

  function actualizarDescuentoGrupo(id, campo, valor) {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, [campo]: Number(valor) } : g))
  }

  function toggleRequierePapeles(id, valor) {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, requierePapeles: valor } : g))
  }

  // Un sub-rubro específico ("RUBRO::SUBRUBRO") es independiente del rubro
  // completo: no se sacan entre sí, para poder tener una excepción puntual
  // (ej: Motos aparte, mientras el resto de Movilidad sigue en General).
  function toggleSubRubroGrupo(grupoId, clave) {
    setGrupos(prev => prev.map(g => {
      if (g.id === grupoId) {
        const tiene = g.rubrosDux.includes(clave)
        return { ...g, rubrosDux: tiene ? g.rubrosDux.filter(r => r !== clave) : [...g.rubrosDux, clave] }
      }
      return { ...g, rubrosDux: g.rubrosDux.filter(r => r !== clave) }
    }))
  }

  function toggleRubroGrupo(grupoId, rubro) {
    setGrupos(prev => prev.map(g => {
      if (g.id === grupoId) {
        const tiene = g.rubrosDux.includes(rubro)
        return { ...g, rubrosDux: tiene ? g.rubrosDux.filter(r => r !== rubro) : [...g.rubrosDux, rubro] }
      }
      // un rubro no puede pertenecer a dos grupos de PowerCred a la vez
      return { ...g, rubrosDux: g.rubrosDux.filter(r => r !== rubro) }
    }))
  }

  function seleccionarTodosRubros(grupoId) {
    setGrupos(prev => prev.map(g => {
      if (g.id === grupoId) return { ...g, rubrosDux: [...rubrosDuxDisponibles] }
      return { ...g, rubrosDux: [] }
    }))
  }

  function deseleccionarTodosRubros(grupoId) {
    setGrupos(prev => prev.map(g => g.id === grupoId ? { ...g, rubrosDux: [] } : g))
  }

  function actualizarPowercredGrupo(grupoId, periodicidad, cuotas, valor) {
    setGrupos(prev => prev.map(g => g.id !== grupoId ? g : {
      ...g,
      powercred: {
        ...g.powercred,
        [periodicidad]: { ...g.powercred[periodicidad], [cuotas]: Number(valor) }
      }
    }))
  }

  // ── Grupos de Tarjeta de Crédito (independientes) ───────────
  function agregarGrupoTarjeta() {
    const nombre = nuevoGrupoTarjetaNombre.trim()
    if (!nombre) return
    setGruposTarjeta(prev => [...prev, grupoTarjetaVacio(nombre)])
    setNuevoGrupoTarjetaNombre('')
  }

  function eliminarGrupoTarjeta(id) {
    setGruposTarjeta(prev => prev.filter(g => g.id !== id))
  }

  function renombrarGrupoTarjeta(id, nombre) {
    setGruposTarjeta(prev => prev.map(g => g.id === id ? { ...g, nombre } : g))
  }

  function toggleSubRubroGrupoTarjeta(grupoId, clave) {
    setGruposTarjeta(prev => prev.map(g => {
      if (g.id === grupoId) {
        const tiene = g.rubrosDux.includes(clave)
        return { ...g, rubrosDux: tiene ? g.rubrosDux.filter(r => r !== clave) : [...g.rubrosDux, clave] }
      }
      return { ...g, rubrosDux: g.rubrosDux.filter(r => r !== clave) }
    }))
  }

  function toggleRubroGrupoTarjeta(grupoId, rubro) {
    setGruposTarjeta(prev => prev.map(g => {
      if (g.id === grupoId) {
        const tiene = g.rubrosDux.includes(rubro)
        return { ...g, rubrosDux: tiene ? g.rubrosDux.filter(r => r !== rubro) : [...g.rubrosDux, rubro] }
      }
      // un rubro no puede pertenecer a dos grupos de tarjeta a la vez
      return { ...g, rubrosDux: g.rubrosDux.filter(r => r !== rubro) }
    }))
  }

  function seleccionarTodosRubrosTarjeta(grupoId) {
    setGruposTarjeta(prev => prev.map(g => {
      if (g.id === grupoId) return { ...g, rubrosDux: [...rubrosDuxDisponibles] }
      return { ...g, rubrosDux: [] }
    }))
  }

  function deseleccionarTodosRubrosTarjeta(grupoId) {
    setGruposTarjeta(prev => prev.map(g => g.id === grupoId ? { ...g, rubrosDux: [] } : g))
  }

  function actualizarTarjetaGrupo(grupoId, cuotas, valor) {
    setGruposTarjeta(prev => prev.map(g => g.id !== grupoId ? g : {
      ...g,
      tarjeta: { ...g.tarjeta, [cuotas]: Number(valor) }
    }))
  }

  function agregarCuotaTarjeta(grupoId) {
    const cuotas = parseInt(nuevaCuota[grupoId])
    if (!cuotas || cuotas <= 0) return
    const clave = nuevaCuotaNaranja[grupoId] ? `${cuotas}-naranja` : `${cuotas}`
    setGruposTarjeta(prev => prev.map(g => g.id !== grupoId ? g : {
      ...g,
      tarjeta: { ...g.tarjeta, [clave]: g.tarjeta[clave] ?? 0 }
    }))
    setNuevaCuota(prev => ({ ...prev, [grupoId]: '' }))
    setNuevaCuotaNaranja(prev => ({ ...prev, [grupoId]: false }))
  }

  function quitarCuotaTarjeta(grupoId, cuotas) {
    setGruposTarjeta(prev => prev.map(g => {
      if (g.id !== grupoId) return g
      const { [cuotas]: _, ...resto } = g.tarjeta
      return { ...g, tarjeta: resto }
    }))
  }

  // ── Papeles (costo extra, ej: trámites de Motos) ────────────
  function agregarPapel() {
    const nombre = nuevoPapelNombre.trim()
    if (!nombre) return
    setPapeles(prev => [...prev, papelesVacio(nombre)])
    setNuevoPapelNombre('')
  }

  function eliminarPapel(id) {
    setPapeles(prev => prev.filter(p => p.id !== id))
  }

  function renombrarPapel(id, nombre) {
    setPapeles(prev => prev.map(p => p.id === id ? { ...p, nombre } : p))
  }

  function actualizarCostoPapel(id, costo) {
    setPapeles(prev => prev.map(p => p.id === id ? { ...p, costo: Number(costo) } : p))
  }

  const tabs = [
    { key: 'negocio', label: 'Datos del negocio' },
    { key: 'pagare', label: 'Pagaré' },
    { key: 'powercred', label: 'PowerCred' },
    { key: 'tarjeta', label: 'Tarjeta de Crédito' },
    { key: 'papeles', label: 'Papeles' },
    { key: 'tasas', label: 'Préstamo en efectivo' },
    { key: 'mora', label: 'Interés mora' },
    { key: 'backup', label: 'Backup' },
  ]

  return (
    <div className="max-w-4xl space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Datos del negocio */}
      {tab === 'negocio' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Datos del Negocio</h3>
          {[
            { key: 'nombre', label: 'Nombre del negocio' },
            { key: 'subtitulo', label: 'Subtítulo (ej: PRÉSTAMOS)' },
            { key: 'direccion', label: 'Dirección' },
            { key: 'localidad', label: 'Localidad' },
            { key: 'provincia', label: 'Provincia' },
            { key: 'telefono', label: 'Teléfono' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input type="text" className="input-field"
                value={negocio[f.key] || ''}
                onChange={e => setNegocio(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* Pagaré */}
      {tab === 'pagare' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Datos del Pagaré</h3>
          {[
            { key: 'localidad', label: 'Localidad de emisión' },
            { key: 'acreedor', label: 'Nombre del acreedor' },
            { key: 'cuit', label: 'CUIT del acreedor' },
            { key: 'direccion', label: 'Dirección de pago' },
            { key: 'ciudad', label: 'Ciudad de pago' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input type="text" className="input-field"
                value={pagare[f.key] || ''}
                onChange={e => setPagare(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* PowerCred: rubros de Dux + tasas PowerCred + alta/baja de grupos */}
      {tab === 'powercred' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-gray-500">
              Cada grupo define qué rubros de Dux le pertenecen y sus tasas de PowerCred
              (mensual/quincenal/semanal). Cuando se busca un producto (por código de barras
              o por categoría), el sistema detecta el grupo automáticamente. El grupo <strong>General</strong>{' '}
              es el que se usa cuando el rubro del producto no está asignado a ningún otro grupo.
              Estos grupos son independientes de los de Tarjeta de Crédito (pestaña aparte).
            </p>
          </div>

          {grupos.map(grupo => (
            <div key={grupo.id} className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  className="input-field font-semibold text-gray-900 max-w-xs"
                  value={grupo.nombre}
                  onChange={e => renombrarGrupo(grupo.id, e.target.value)}
                  disabled={grupo.esDefault}
                />
                {!grupo.esDefault && (
                  <button onClick={() => eliminarGrupo(grupo.id)} className="text-xs text-red-500 hover:underline">
                    Eliminar grupo
                  </button>
                )}
              </div>

              {/* Rubros de Dux asignados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Rubros de Dux en este grupo</label>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => seleccionarTodosRubros(grupo.id)} className="text-blue-600 hover:underline">
                      Seleccionar todos
                    </button>
                    <button onClick={() => deseleccionarTodosRubros(grupo.id)} className="text-gray-500 hover:underline">
                      Ninguno
                    </button>
                  </div>
                </div>
                {cargandoRubros ? (
                  <div className="text-sm text-gray-400">Cargando rubros de Dux...</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
                    {rubrosDuxDisponibles.map(r => {
                      const activo = grupo.rubrosDux.includes(r)
                      return (
                        <button
                          key={r}
                          onClick={() => toggleRubroGrupo(grupo.id, r)}
                          className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                            activo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                )}
                {grupo.esDefault && (
                  <p className="text-xs text-gray-400 mt-1">
                    "General" se aplica a cualquier rubro que no esté asignado a otro grupo, no hace falta tildar nada acá.
                  </p>
                )}
              </div>

              {/* Sub-rubros específicos (excepciones dentro de un rubro) */}
              <div>
                <label className="label mb-2">Sub-rubros específicos (excepción dentro de un rubro, ej: Movilidad → Motos)</label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
                  {subRubrosDisponibles.map(({ rubro, sub, clave }) => {
                    const activo = grupo.rubrosDux.includes(clave)
                    return (
                      <button
                        key={clave}
                        onClick={() => toggleSubRubroGrupo(grupo.id, clave)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          activo ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {rubro} / {sub}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Requiere papeles (ej: Motos) */}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={!!grupo.requierePapeles}
                  onChange={e => toggleRequierePapeles(grupo.id, e.target.checked)}
                />
                Este grupo requiere elegir "Papeles" antes de mostrar las cuotas (ver pestaña Papeles)
              </label>

              {/* Descuentos por método de pago (Consulta) */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Descuentos en Consulta</div>
                <div className="flex gap-4">
                  <div>
                    <label className="label text-xs">Efectivo</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input-field w-20 text-center text-sm"
                        value={grupo.descuentoEfectivo ?? 0}
                        onChange={e => actualizarDescuentoGrupo(grupo.id, 'descuentoEfectivo', e.target.value)}
                        step="0.5" min="0"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Transferencia</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input-field w-20 text-center text-sm"
                        value={grupo.descuentoTransferencia ?? 0}
                        onChange={e => actualizarDescuentoGrupo(grupo.id, 'descuentoTransferencia', e.target.value)}
                        step="0.5" min="0"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasas PowerCred */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Tasas PowerCred</div>
                {[
                  { key: 'mensual', label: 'Mensuales' },
                  { key: 'quincenal', label: 'Quincenales' },
                  { key: 'semanal', label: 'Semanales' },
                ].map(({ key: period, label: periodLabel }) => (
                  <div key={period} className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">{periodLabel}</div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(grupo.powercred[period] || {}).map(([cuotas, tasa]) => (
                        <div key={cuotas} className="flex flex-col items-center gap-1">
                          <div className="text-xs text-gray-500">{cuotas} cuotas</div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="input-field w-20 text-center text-sm"
                              value={tasa}
                              onChange={e => actualizarPowercredGrupo(grupo.id, period, cuotas, e.target.value)}
                              step="0.5" min="0"
                            />
                            <span className="text-gray-400 text-sm">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Agregar grupo nuevo */}
          <div className="card">
            <label className="label">Agregar grupo nuevo</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Ej: Heladeras y Freezers"
                value={nuevoGrupoNombre}
                onChange={e => setNuevoGrupoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarGrupo()}
              />
              <button onClick={agregarGrupo} className="btn-primary px-5">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta de Crédito: grupos propios, independientes de PowerCred */}
      {tab === 'tarjeta' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-gray-500">
              Los grupos de Tarjeta de Crédito son independientes de los de PowerCred: un rubro
              puede estar en un grupo distinto (o en ninguno) acá. El grupo <strong>General</strong>{' '}
              se usa cuando el rubro del producto no está asignado a ningún grupo de tarjeta.
            </p>
          </div>

          {gruposTarjeta.map(grupo => (
            <div key={grupo.id} className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  className="input-field font-semibold text-gray-900 max-w-xs"
                  value={grupo.nombre}
                  onChange={e => renombrarGrupoTarjeta(grupo.id, e.target.value)}
                  disabled={grupo.esDefault}
                />
                {!grupo.esDefault && (
                  <button onClick={() => eliminarGrupoTarjeta(grupo.id)} className="text-xs text-red-500 hover:underline">
                    Eliminar grupo
                  </button>
                )}
              </div>

              {/* Rubros de Dux asignados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Rubros de Dux en este grupo</label>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => seleccionarTodosRubrosTarjeta(grupo.id)} className="text-blue-600 hover:underline">
                      Seleccionar todos
                    </button>
                    <button onClick={() => deseleccionarTodosRubrosTarjeta(grupo.id)} className="text-gray-500 hover:underline">
                      Ninguno
                    </button>
                  </div>
                </div>
                {cargandoRubros ? (
                  <div className="text-sm text-gray-400">Cargando rubros de Dux...</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
                    {rubrosDuxDisponibles.map(r => {
                      const activo = grupo.rubrosDux.includes(r)
                      return (
                        <button
                          key={r}
                          onClick={() => toggleRubroGrupoTarjeta(grupo.id, r)}
                          className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                            activo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                )}
                {grupo.esDefault && (
                  <p className="text-xs text-gray-400 mt-1">
                    "General" se aplica a cualquier rubro que no esté asignado a otro grupo de tarjeta, no hace falta tildar nada acá.
                  </p>
                )}
              </div>

              {/* Sub-rubros específicos (excepciones dentro de un rubro) */}
              <div>
                <label className="label mb-2">Sub-rubros específicos (excepción dentro de un rubro, ej: Movilidad → Motos)</label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
                  {subRubrosDisponibles.map(({ rubro, sub, clave }) => {
                    const activo = grupo.rubrosDux.includes(clave)
                    return (
                      <button
                        key={clave}
                        onClick={() => toggleSubRubroGrupoTarjeta(grupo.id, clave)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          activo ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {rubro} / {sub}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tasas Tarjeta */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Tasas Tarjeta de Crédito</div>
                <div className="flex flex-wrap gap-3 items-end">
                  {Object.entries(grupo.tarjeta || {})
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10) || (esCuotaTarjetaNaranja(a[0]) ? 1 : -1))
                    .map(([clave, tasa]) => (
                      <div key={clave} className="flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          {parseInt(clave, 10)} cuotas
                          {esCuotaTarjetaNaranja(clave) && (
                            <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-orange-50 text-orange-600">Naranja</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="input-field w-20 text-center text-sm"
                            value={tasa}
                            onChange={e => actualizarTarjetaGrupo(grupo.id, clave, e.target.value)}
                            step="0.5" min="0"
                          />
                          <span className="text-gray-400 text-sm">%</span>
                          <button onClick={() => quitarCuotaTarjeta(grupo.id, clave)} className="text-gray-300 hover:text-red-500 text-sm ml-0.5">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input-field w-16 text-center text-sm"
                      placeholder="N°"
                      value={nuevaCuota[grupo.id] || ''}
                      onChange={e => setNuevaCuota(prev => ({ ...prev, [grupo.id]: e.target.value }))}
                      min="1"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={!!nuevaCuotaNaranja[grupo.id]}
                        onChange={e => setNuevaCuotaNaranja(prev => ({ ...prev, [grupo.id]: e.target.checked }))}
                      />
                      Solo Naranja
                    </label>
                    <button onClick={() => agregarCuotaTarjeta(grupo.id)} className="btn-secondary text-xs px-2 py-1.5">
                      + cuota
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Agregar grupo nuevo */}
          <div className="card">
            <label className="label">Agregar grupo nuevo</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Ej: Sin interés especial"
                value={nuevoGrupoTarjetaNombre}
                onChange={e => setNuevoGrupoTarjetaNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarGrupoTarjeta()}
              />
              <button onClick={agregarGrupoTarjeta} className="btn-primary px-5">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Papeles (costo extra, ej: trámites de Motos) */}
      {tab === 'papeles' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm text-gray-500">
              Opciones de costo de "papeles" (trámites) que se suman al precio del artículo
              antes de calcular las cuotas, para los grupos de PowerCred marcados como
              "requiere elegir Papeles" (pestaña PowerCred).
            </p>
          </div>

          <div className="card">
            <div className="space-y-3">
              {papeles.length === 0 && (
                <p className="text-sm text-gray-400">Todavía no cargaste ninguna opción de papeles.</p>
              )}
              {papeles.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <input
                    type="text"
                    className="input-field flex-1"
                    value={p.nombre}
                    onChange={e => renombrarPapel(p.id, e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      className="input-field w-32 text-center"
                      value={p.costo}
                      onChange={e => actualizarCostoPapel(p.id, e.target.value)}
                      step="100" min="0"
                    />
                  </div>
                  <button onClick={() => eliminarPapel(p.id)} className="text-xs text-red-500 hover:underline">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <label className="label">Agregar opción nueva</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Ej: Patentamiento CABA"
                value={nuevoPapelNombre}
                onChange={e => setNuevoPapelNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarPapel()}
              />
              <button onClick={agregarPapel} className="btn-primary px-5">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Préstamo en efectivo */}
      {tab === 'tasas' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">💵 Préstamo en Efectivo</h3>
          {[
            { key: 'mensual', label: 'Mensuales' },
            { key: 'quincenal', label: 'Quincenales' },
            { key: 'semanal', label: 'Semanales' },
          ].map(({ key: period, label: periodLabel }) => (
            <div key={period} className="mb-5">
              <div className="text-sm font-medium text-gray-600 mb-2">{periodLabel}</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(tasas.efectivo?.[period] || {}).map(([cuotas, tasa]) => (
                  <div key={cuotas} className="flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500">{cuotas} cuotas</div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input-field w-20 text-center text-sm"
                        value={tasa}
                        onChange={e => actualizarTasa('efectivo', period, cuotas, e.target.value)}
                        step="0.5" min="0"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mora */}
      {tab === 'mora' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Interés por mora</h3>
          <div>
            <label className="label">Tasa diaria de mora (%)</label>
            <div className="flex items-center gap-2">
              <input type="number"
                className="input-field w-32"
                value={mora.tasa_diaria}
                onChange={e => setMora({ tasa_diaria: parseFloat(e.target.value) })}
                step="0.05" min="0" />
              <span className="text-gray-500 text-sm">% por día</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Mora = días de atraso × {mora.tasa_diaria}% × importe de la cuota
            </p>
          </div>
        </div>
      )}

      {/* Backup */}
      {tab === 'backup' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Backup de datos</h3>
          <p className="text-sm text-gray-500">
            Exporta todos los datos (clientes, créditos, cuotas, pagos) a un archivo JSON.
            Guardá este archivo en un lugar seguro como respaldo.
          </p>
          <button onClick={exportarBackup} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Descargar backup JSON
          </button>
          <p className="text-xs text-gray-400">
            Recomendado: hacer backup al menos una vez por semana.
            El archivo se descargará con la fecha actual en el nombre.
          </p>
        </div>
      )}

      {/* Guardar */}
      {tab !== 'backup' && (
        <div className="flex items-center gap-4">
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {mensaje && (
            <span className="text-green-600 text-sm font-medium">{mensaje}</span>
          )}
        </div>
      )}
    </div>
  )
}
