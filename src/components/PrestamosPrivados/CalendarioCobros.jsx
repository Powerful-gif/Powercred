import { Link } from 'react-router-dom'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'
import { cuotasPorCobrar, resumirCalendario } from '../../lib/prestamosPrivados'

const DIAS_VISIBLES = 30

function Dato({ titulo, valor, detalle, color = 'text-gray-900' }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{titulo}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{valor}</div>
      <div className="text-xs text-gray-400 mt-1">{detalle}</div>
    </div>
  )
}

export default function CalendarioCobros({ prestamos }) {
  const hoy = hoyArgentina()
  const pendientes = cuotasPorCobrar(prestamos)
  const calendario = resumirCalendario(pendientes, hoy)
  const limite = new Date(hoy + 'T12:00:00')
  limite.setDate(limite.getDate() + DIAS_VISIBLES)
  const hasta = limite.toISOString().slice(0, 10)
  const visibles = pendientes.filter(c => c.fecha <= hasta)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Dato
          titulo="Atrasado"
          valor={formatMoneda(calendario.atrasado)}
          detalle="Vencido sin cobrar, sin punitorios"
          color={calendario.atrasado > 0 ? 'text-red-600' : 'text-gray-900'}
        />
        <Dato titulo="Esta semana" valor={formatMoneda(calendario.semana)} detalle="Vence hasta el domingo" color="text-blue-800" />
        <Dato titulo="Este mes" valor={formatMoneda(calendario.mes)} detalle="Vence desde hoy a fin de mes" color="text-blue-800" />
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Próximos {DIAS_VISIBLES} días</h3>
        {visibles.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No hay cuotas para cobrar en estos días.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Persona</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Quién prestó</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Saldo</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(c => (
                  <tr key={c.id} className={`border-b border-gray-100 ${c.fecha < hoy ? 'bg-red-50' : ''}`}>
                    <td className={`py-2 px-2 ${c.fecha < hoy ? 'text-red-600 font-semibold' : ''}`}>{formatFecha(c.fecha)}</td>
                    <td className="py-2 px-2 font-medium">{c.persona?.apellido}, {c.persona?.nombre}</td>
                    <td className="py-2 px-2">{c.prestamista}</td>
                    <td className="py-2 px-2 text-center">{c.numeroCuota}/{c.cantidadCuotas}</td>
                    <td className="py-2 px-2 text-right font-semibold">{formatMoneda(c.saldo)}</td>
                    <td className="py-2 px-2 text-right">
                      <Link to={`/prestamos-privados/${c.prestamoId}`} className="text-blue-600 hover:underline text-xs font-medium">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {calendario.meses.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Lo que entra por mes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Mes</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Capital</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Interés</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {calendario.meses.map(m => (
                  <tr key={m.mes} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium">{m.mes.split('-').reverse().join('/')}</td>
                    <td className="py-2 px-2 text-right">{formatMoneda(m.capital)}</td>
                    <td className="py-2 px-2 text-right text-green-700">{formatMoneda(m.interes)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{formatMoneda(m.total)}</td>
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
