import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMoneda, formatFecha, hoyArgentina, diasEntre } from '../lib/formatters'
import { calcularEstadoCredito } from '../lib/calculos'
import { useAuth } from '../context/AuthContext'

function StatCard({ title, value, sub, color, icon, onClick, detail }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        {detail}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin, userNombre } = useAuth()
  const [stats, setStats] = useState({
    totalActivos: 0,
    cobradoHoy: 0,
    cobradoPorMetodo: { efectivo: 0, transferencia: 0, tarjeta: 0 },
    atrasados: [],
    enMora: [],
    proxVencimientos: [],
    cartera: { activo: 0, atrasado: 0, mora: 0, incobrable: 0, cancelado: 0 }
  })
  const [loading, setLoading] = useState(true)
  const hoy = hoyArgentina()

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      let creditosQuery = supabase
        .from('creditos')
        .select('*, clientes(nombre, apellido, codigo, id, celular)')
        .in('estado', ['activo', 'atrasado', 'mora', 'incobrable', 'cancelado'])

      if (!isAdmin && userNombre) {
        creditosQuery = creditosQuery.or(`vendedor.eq.${userNombre},vendedor.is.null`)
      }

      const { data: creditos } = await creditosQuery

      const creditoIds = (creditos || []).map(c => c.id)
      let cuotasPorCredito = {}
      if (creditoIds.length > 0) {
        const { data: todasCuotas } = await supabase
          .from('cuotas')
          .select('*')
          .in('credito_id', creditoIds)
        ;(todasCuotas || []).forEach(c => {
          if (!cuotasPorCredito[c.credito_id]) cuotasPorCredito[c.credito_id] = []
          cuotasPorCredito[c.credito_id].push(c)
        })
      }

      // Recalcular estados
      const estadosActualizados = {}
      for (const cred of (creditos || [])) {
        const cuotas = cuotasPorCredito[cred.id] || []
        estadosActualizados[cred.id] = calcularEstadoCredito(cuotas, cred.estado)
      }

      // Cartera
      const cartera = { activo: 0, atrasado: 0, mora: 0, incobrable: 0, cancelado: 0 }
      for (const [, estado] of Object.entries(estadosActualizados)) {
        if (cartera[estado] !== undefined) cartera[estado]++
      }

      // Créditos atrasados (1-30 días) con máximo días de atraso
      const atrasados = (creditos || [])
        .filter(c => estadosActualizados[c.id] === 'atrasado')
        .map(c => {
          const cuotas = cuotasPorCredito[c.id] || []
          const vencidas = cuotas.filter(q => q.estado !== 'pagada' && q.fecha_vencimiento < hoy)
          const maxDias = vencidas.length > 0
            ? Math.max(...vencidas.map(q => diasEntre(q.fecha_vencimiento, hoy)))
            : 0
          const cuotasVencidas = vencidas.length
          return { ...c, diasAtraso: maxDias, cuotasVencidas }
        })
        .sort((a, b) => b.diasAtraso - a.diasAtraso)

      // Créditos en mora (30+ días)
      const enMoraCreditos = (creditos || [])
        .filter(c => estadosActualizados[c.id] === 'mora')
        .map(c => {
          const cuotas = cuotasPorCredito[c.id] || []
          const vencidas = cuotas.filter(q => q.estado !== 'pagada' && q.fecha_vencimiento < hoy)
          const maxDias = vencidas.length > 0
            ? Math.max(...vencidas.map(q => diasEntre(q.fecha_vencimiento, hoy)))
            : 0
          return { ...c, diasAtraso: maxDias, cuotasVencidas: vencidas.length }
        })
        .sort((a, b) => b.diasAtraso - a.diasAtraso)

      // Cobrado hoy
      const { data: pagosHoy } = await supabase
        .from('pagos')
        .select('total_cobrado, metodo_pago')
        .eq('fecha_pago', hoy)
      const cobradoHoy = (pagosHoy || []).reduce((s, p) => s + Number(p.total_cobrado), 0)
      const cobradoPorMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0 }
      for (const p of (pagosHoy || [])) {
        const m = p.metodo_pago || 'efectivo'
        if (cobradoPorMetodo[m] !== undefined) cobradoPorMetodo[m] += Number(p.total_cobrado)
      }

      // Próximos 3 días
      const fecha3 = new Date(hoy)
      fecha3.setDate(fecha3.getDate() + 3)
      const fecha3Str = fecha3.toISOString().split('T')[0]
      const { data: proxVenc } = await supabase
        .from('cuotas')
        .select('*, creditos(numero_credito, clientes(nombre, apellido))')
        .gt('fecha_vencimiento', hoy)
        .lte('fecha_vencimiento', fecha3Str)
        .in('estado', ['pendiente'])

      setStats({
        totalActivos: cartera.activo + cartera.atrasado + cartera.mora,
        cobradoHoy,
        cobradoPorMetodo,
        atrasados,
        enMora: enMoraCreditos,
        proxVencimientos: proxVenc || [],
        cartera
      })
    } catch (e) {
      console.error('Error cargando dashboard', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Cargando dashboard...</div>
    </div>
  )

  const { totalActivos, cobradoHoy, cobradoPorMetodo, atrasados, enMora, proxVencimientos, cartera } = stats

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Créditos activos"
          value={totalActivos}
          sub="activos + atrasados + mora"
          color="bg-blue-100 text-blue-700"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
          onClick={() => navigate('/creditos')}
        />
        <StatCard
          title="Cobrado hoy"
          value={formatMoneda(cobradoHoy)}
          color="bg-green-100 text-green-700"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          detail={cobradoHoy > 0 && (
            <div className="mt-2 space-y-0.5">
              {cobradoPorMetodo.efectivo > 0 && (
                <div className="text-xs text-gray-500">💵 Efectivo: <span className="font-medium text-gray-700">{formatMoneda(cobradoPorMetodo.efectivo)}</span></div>
              )}
              {cobradoPorMetodo.transferencia > 0 && (
                <div className="text-xs text-gray-500">🏦 Transferencia: <span className="font-medium text-gray-700">{formatMoneda(cobradoPorMetodo.transferencia)}</span></div>
              )}
              {cobradoPorMetodo.tarjeta > 0 && (
                <div className="text-xs text-gray-500">💳 Tarjeta: <span className="font-medium text-gray-700">{formatMoneda(cobradoPorMetodo.tarjeta)}</span></div>
              )}
            </div>
          )}
        />
        <StatCard
          title="Atrasados"
          value={atrasados.length}
          sub="1 a 30 días de atraso"
          color="bg-orange-100 text-orange-700"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          onClick={() => navigate('/creditos?estado=atrasado')}
        />
        <StatCard
          title="En mora"
          value={enMora.length}
          sub="+30 días de atraso"
          color="bg-red-100 text-red-700"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
          onClick={() => navigate('/creditos?estado=mora')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resumen cartera */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Resumen de Cartera</h2>
          <div className="space-y-3">
            {[
              { label: 'Al día', key: 'activo', color: 'bg-green-500' },
              { label: 'Atrasado', key: 'atrasado', color: 'bg-orange-400' },
              { label: 'En mora', key: 'mora', color: 'bg-red-500' },
              { label: 'Incobrable', key: 'incobrable', color: 'bg-gray-400' },
              { label: 'Cancelado', key: 'cancelado', color: 'bg-blue-400' },
            ].map(item => {
              const total = Object.values(cartera).reduce((a, b) => a + b, 0) || 1
              const pct = Math.round((cartera[item.key] / total) * 100)
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold">{cartera[item.key]} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Próximos vencimientos */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Próximos 3 días</h2>
          {proxVencimientos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin vencimientos próximos</p>
          ) : (
            <div className="space-y-2">
              {proxVencimientos.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">
                      {c.creditos?.clientes?.nombre} {c.creditos?.clientes?.apellido}
                    </div>
                    <div className="text-xs text-gray-400">{c.creditos?.numero_credito}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-orange-600">{formatMoneda(c.importe_original)}</div>
                    <div className="text-xs text-gray-400">{formatFecha(c.fecha_vencimiento)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Créditos Atrasados */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Créditos Atrasados
            <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              1-30 días
            </span>
          </h2>
          <Link to="/creditos?estado=atrasado" className="text-sm text-orange-600 hover:underline">Ver en créditos →</Link>
        </div>
        {atrasados.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay créditos atrasados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Crédito</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Cuotas vencidas</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Días de atraso</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-right py-2"></th>
                </tr>
              </thead>
              <tbody>
                {atrasados.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-orange-50">
                    <td className="py-2 font-medium">
                      {c.clientes?.apellido}, {c.clientes?.nombre}
                      <div className="text-xs text-gray-400">{c.clientes?.codigo}</div>
                    </td>
                    <td className="py-2 text-gray-500 font-mono text-xs">{c.numero_credito}</td>
                    <td className="py-2 text-center">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {c.cuotasVencidas}
                      </span>
                    </td>
                    <td className="py-2 text-center font-semibold text-orange-600">{c.diasAtraso} días</td>
                    <td className="py-2 text-right font-semibold">{formatMoneda(c.importe_cuota)}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.clientes?.celular && (
                          <a
                            href={`https://wa.me/549${c.clientes.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${c.clientes.nombre}, te recordamos que tenés una cuota vencida de ${formatMoneda(c.importe_cuota)} del crédito ${c.numero_credito} (${c.diasAtraso} días de atraso). Comunicate con nosotros para regularizar. ¡Gracias!`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WA
                          </a>
                        )}
                        <Link
                          to={`/cobros?cliente=${c.clientes?.id}`}
                          className="text-orange-600 hover:underline text-xs font-medium"
                        >
                          Cobrar →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Créditos en Mora */}
      {enMora.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Créditos en Mora
              <span className="ml-2 text-xs font-normal text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                +30 días
              </span>
            </h2>
            <Link to="/creditos?estado=mora" className="text-sm text-red-600 hover:underline">Ver en créditos →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Crédito</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Cuotas vencidas</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Días de atraso</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-right py-2"></th>
                </tr>
              </thead>
              <tbody>
                {enMora.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-red-50">
                    <td className="py-2 font-medium">
                      {c.clientes?.apellido}, {c.clientes?.nombre}
                      <div className="text-xs text-gray-400">{c.clientes?.codigo}</div>
                    </td>
                    <td className="py-2 text-gray-500 font-mono text-xs">{c.numero_credito}</td>
                    <td className="py-2 text-center">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {c.cuotasVencidas}
                      </span>
                    </td>
                    <td className="py-2 text-center font-semibold text-red-600">{c.diasAtraso} días</td>
                    <td className="py-2 text-right font-semibold">{formatMoneda(c.importe_cuota)}</td>
                    <td className="py-2 text-right">
                      <Link
                        to={`/cobros?cliente=${c.clientes?.id}`}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Cobrar →
                      </Link>
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
