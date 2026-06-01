import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoneda, formatFecha, hoyArgentina } from '../lib/formatters'

const HOY = hoyArgentina()

function fechaHaceN(dias) {
  const d = new Date(HOY + 'T12:00:00')
  d.setDate(d.getDate() - dias)
  return d.toISOString().split('T')[0]
}

function fechaEnN(dias) {
  const d = new Date(HOY + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function primerDiaMes() {
  return HOY.substring(0, 8) + '01'
}

export default function Reportes() {
  const [tab, setTab] = useState('cobranzas')
  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(HOY)
  const [datos, setDatos] = useState([])
  const [loading, setLoading] = useState(false)
  const [totales, setTotales] = useState({})
  const [metodoFiltro, setMetodoFiltro] = useState('todos')

  useEffect(() => {
    cargarReporte()
  }, [tab, desde, hasta])

  async function cargarReporte() {
    setLoading(true)
    try {
      if (tab === 'cobranzas') await reporteCobranzas()
      else if (tab === 'creditos') await reporteCreditos()
      else if (tab === 'mora') await reporteMora()
      else if (tab === 'vencimientos') await reporteVencimientos()
      else if (tab === 'cartera') await reporteCartera()
      else if (tab === 'cobrador') await reporteCobrador()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function reporteCobranzas() {
    const { data } = await supabase
      .from('pagos')
      .select('*, clientes(nombre, apellido, codigo), creditos(numero_credito)')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago', { ascending: false })
    setDatos(data || [])
    const total = (data || []).reduce((s, p) => s + Number(p.total_cobrado), 0)
    setTotales({ total, cantidad: (data || []).length })
  }

  async function reporteCreditos() {
    const { data } = await supabase
      .from('creditos')
      .select('*, clientes(nombre, apellido, codigo)')
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: false })
    setDatos(data || [])
    const total = (data || []).reduce((s, c) => s + Number(c.importe_original), 0)
    setTotales({ total, cantidad: (data || []).length })
  }

  async function reporteMora() {
    const { data } = await supabase
      .from('creditos')
      .select('*, clientes(nombre, apellido, codigo, celular, localidad)')
      .in('estado', ['mora', 'incobrable'])
      .order('estado')
    setDatos(data || [])
    setTotales({ cantidad: (data || []).length })
  }

  async function reporteVencimientos() {
    const { data } = await supabase
      .from('cuotas')
      .select('*, creditos(numero_credito, cobrador, clientes(nombre, apellido, codigo, celular))')
      .gte('fecha_vencimiento', HOY)
      .lte('fecha_vencimiento', fechaEnN(7))
      .in('estado', ['pendiente'])
      .order('fecha_vencimiento')
    setDatos(data || [])
    const total = (data || []).reduce((s, c) => s + Number(c.importe_original), 0)
    setTotales({ total, cantidad: (data || []).length })
  }

  async function reporteCartera() {
    const { data } = await supabase
      .from('creditos')
      .select('estado, importe_original, total_con_intereses')
      .neq('estado', 'cancelado')
    const resumen = {}
    for (const c of (data || [])) {
      if (!resumen[c.estado]) resumen[c.estado] = { cantidad: 0, importe: 0, total: 0 }
      resumen[c.estado].cantidad++
      resumen[c.estado].importe += Number(c.importe_original)
      resumen[c.estado].total += Number(c.total_con_intereses)
    }
    setDatos(Object.entries(resumen).map(([estado, v]) => ({ estado, ...v })))
    const total = (data || []).reduce((s, c) => s + Number(c.importe_original), 0)
    setTotales({ total, cantidad: (data || []).length })
  }

  async function reporteCobrador() {
    const { data } = await supabase
      .from('pagos')
      .select('cobrador, total_cobrado, fecha_pago')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
    const resumen = {}
    for (const p of (data || [])) {
      const key = p.cobrador || 'Sin asignar'
      if (!resumen[key]) resumen[key] = { cobrador: key, cantidad: 0, total: 0 }
      resumen[key].cantidad++
      resumen[key].total += Number(p.total_cobrado)
    }
    setDatos(Object.values(resumen).sort((a, b) => b.total - a.total))
    const total = (data || []).reduce((s, p) => s + Number(p.total_cobrado), 0)
    setTotales({ total })
  }

  function imprimir() {
    window.print()
  }

  const tabs = [
    { key: 'cobranzas', label: 'Cobranzas' },
    { key: 'creditos', label: 'Créditos otorgados' },
    { key: 'mora', label: 'Clientes en mora' },
    { key: 'vencimientos', label: 'Próx. vencimientos' },
    { key: 'cartera', label: 'Cartera total' },
    { key: 'cobrador', label: 'Por cobrador' },
  ]

  const conFechas = ['cobranzas', 'creditos', 'cobrador']

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros de fecha */}
      {conFechas.includes(tab) && (
        <div className="card flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Desde:</label>
            <input type="date" className="input-field w-auto" value={desde}
              onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Hasta:</label>
            <input type="date" className="input-field w-auto" value={hasta}
              onChange={e => setHasta(e.target.value)} />
          </div>
          <button onClick={cargarReporte} className="btn-secondary text-sm">Actualizar</button>
          <button onClick={() => { setDesde(HOY); setHasta(HOY) }} className="text-sm text-blue-600 hover:underline">Hoy</button>
          <button onClick={() => { setDesde(fechaHaceN(7)); setHasta(HOY) }} className="text-sm text-blue-600 hover:underline">7 días</button>
          <button onClick={() => { setDesde(primerDiaMes()); setHasta(HOY) }} className="text-sm text-blue-600 hover:underline">Este mes</button>
        </div>
      )}

      {/* Filtro método de pago (solo cobranzas) */}
      {tab === 'cobranzas' && (
        <div className="flex gap-2 flex-wrap">
          {['todos', 'efectivo', 'transferencia', 'tarjeta'].map(m => (
            <button key={m} onClick={() => setMetodoFiltro(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                metodoFiltro === m ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {m === 'todos' ? 'Todos' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Resumen */}
      {(totales.total !== undefined || totales.cantidad) && (
        <div className="flex gap-4 flex-wrap">
          {totales.cantidad !== undefined && (
            <div className="card py-3 px-5">
              <div className="text-xs text-gray-500">Registros</div>
              <div className="text-2xl font-bold text-gray-900">{totales.cantidad}</div>
            </div>
          )}
          {totales.total !== undefined && (
            <div className="card py-3 px-5">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-2xl font-bold text-blue-800">{formatMoneda(totales.total)}</div>
            </div>
          )}
          <button onClick={imprimir} className="btn-secondary self-center flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Imprimir reporte
          </button>
        </div>
      )}

      {/* Tabla de datos */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : datos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Sin datos para el período seleccionado</div>
        ) : (
          <div className="overflow-x-auto">

            {/* Cobranzas */}
            {tab === 'cobranzas' && (() => {
              const datosFiltrados = metodoFiltro === 'todos'
                ? datos
                : datos.filter(p => (p.metodo_pago || 'efectivo') === metodoFiltro)
              const totalFiltrado = datosFiltrados.reduce((s, p) => s + Number(p.total_cobrado), 0)
              return (
                <>
                  {metodoFiltro !== 'todos' && (
                    <div className="mb-3 text-sm text-gray-500">
                      {datosFiltrados.length} registros · Total: <strong>{formatMoneda(totalFiltrado)}</strong>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead><tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Cliente</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Crédito</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">Cuota</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">Mora</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">Total</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Método</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Cobrador</th>
                    </tr></thead>
                    <tbody>
                      {datosFiltrados.map(p => (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2">{formatFecha(p.fecha_pago)}</td>
                          <td className="py-2 px-2">{p.clientes?.apellido}, {p.clientes?.nombre}</td>
                          <td className="py-2 px-2 font-mono text-xs text-blue-700">{p.creditos?.numero_credito}</td>
                          <td className="py-2 px-2 text-right">{formatMoneda(p.importe_cuota)}</td>
                          <td className="py-2 px-2 text-right text-orange-600">
                            {p.interes_mora > 0 ? formatMoneda(p.interes_mora) : '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold">{formatMoneda(p.total_cobrado)}</td>
                          <td className="py-2 px-2 text-xs text-gray-500 capitalize">{p.metodo_pago || 'efectivo'}</td>
                          <td className="py-2 px-2 text-gray-500 text-xs">{p.cobrador || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )
            })()}

            {/* Créditos otorgados */}
            {tab === 'creditos' && (
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">N° Crédito</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Tipo</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Importe</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuotas</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Estado</th>
                </tr></thead>
                <tbody>
                  {datos.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2">{formatFecha(c.fecha_inicio)}</td>
                      <td className="py-2 px-2 font-mono text-xs text-blue-700">{c.numero_credito}</td>
                      <td className="py-2 px-2">{c.clientes?.apellido}, {c.clientes?.nombre}</td>
                      <td className="py-2 px-2 capitalize text-xs">{c.tipo}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(c.importe_original)}</td>
                      <td className="py-2 px-2 text-center">{c.cantidad_cuotas} {c.periodicidad === 'mensual' ? 'men.' : 'sem.'}</td>
                      <td className="py-2 px-2">
                        <span className={`badge-${c.estado}`}>{c.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Mora */}
            {tab === 'mora' && (
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Código</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Celular</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Localidad</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Crédito</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Estado</th>
                </tr></thead>
                <tbody>
                  {datos.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium">{c.clientes?.apellido}, {c.clientes?.nombre}</td>
                      <td className="py-2 px-2 font-mono text-xs text-blue-700">{c.clientes?.codigo}</td>
                      <td className="py-2 px-2">{c.clientes?.celular}</td>
                      <td className="py-2 px-2">{c.clientes?.localidad}</td>
                      <td className="py-2 px-2 font-mono text-xs">{c.numero_credito}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(c.total_con_intereses)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={c.estado === 'incobrable' ? 'badge-incobrable' : 'badge-mora'}>
                          {c.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Vencimientos */}
            {tab === 'vencimientos' && (
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Celular</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Crédito</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuota N°</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Importe</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Cobrador</th>
                </tr></thead>
                <tbody>
                  {datos.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium">{formatFecha(c.fecha_vencimiento)}</td>
                      <td className="py-2 px-2">{c.creditos?.clientes?.apellido}, {c.creditos?.clientes?.nombre}</td>
                      <td className="py-2 px-2">{c.creditos?.clientes?.celular}</td>
                      <td className="py-2 px-2 font-mono text-xs text-blue-700">{c.creditos?.numero_credito}</td>
                      <td className="py-2 px-2 text-center">{c.numero_cuota}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(c.importe_original)}</td>
                      <td className="py-2 px-2 text-gray-500 text-xs">{c.creditos?.cobrador || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Cartera */}
            {tab === 'cartera' && (
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Estado</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Cantidad</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Capital total</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total con intereses</th>
                </tr></thead>
                <tbody>
                  {datos.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <span className={`badge-${r.estado}`}>{r.estado}</span>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold">{r.cantidad}</td>
                      <td className="py-3 px-2 text-right">{formatMoneda(r.importe)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-blue-700">{formatMoneda(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Por cobrador */}
            {tab === 'cobrador' && (
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Cobrador</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Cobros</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total cobrado</th>
                </tr></thead>
                <tbody>
                  {datos.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium">{r.cobrador}</td>
                      <td className="py-3 px-2 text-right">{r.cantidad}</td>
                      <td className="py-3 px-2 text-right font-bold text-blue-700">{formatMoneda(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
