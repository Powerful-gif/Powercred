import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoneda, formatFecha } from '../lib/formatters'
import { nombresPrestadores, numeroPrestamo, prestamosDe, resumirPrestamo } from '../lib/prestamosPrivados'
import { usePrestamosPrivados } from '../components/PrestamosPrivados/usePrestamosPrivados'
import FiltroPrestadores from '../components/PrestamosPrivados/FiltroPrestadores'
import { ESTADOS_PRESTAMO } from './PrestamosPrivados'

export default function PrestamosLista() {
  const { prestamos, prestamistas, cargando, error } = usePrestamosPrivados()
  const [filtro, setFiltro] = useState('todos')

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (error) return <div className="card text-center py-12 text-red-600">{error}</div>

  // Con una persona elegida, cada préstamo se muestra solo por su parte
  const visibles = filtro === 'todos' ? prestamos : prestamosDe(prestamos, filtro)

  return (
    <div className="space-y-5">
      <FiltroPrestadores prestamistas={prestamistas} filtro={filtro} onCambiar={setFiltro} />

      <div className="card">
        {visibles.length === 0 ? (
          <p className="text-center py-8 text-gray-400">Todavía no hay préstamos cargados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">N°</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Persona</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Quién prestó</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">{filtro === 'todos' ? 'Capital' : 'Su parte'}</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuotas</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => {
                  const estado = ESTADOS_PRESTAMO[resumirPrestamo(p).estado]
                  const pagadas = p.pp_cuotas.filter(c => c.estado === 'pagada').length
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">
                        <Link to={`/prestamos-privados/${p.id}`} className="text-blue-700 hover:underline">
                          {numeroPrestamo(p.numero)}
                        </Link>
                      </td>
                      <td className="py-2 px-2 font-medium">{p.pp_personas?.apellido}, {p.pp_personas?.nombre}</td>
                      <td className="py-2 px-2">{nombresPrestadores(p)}</td>
                      <td className="py-2 px-2">{formatFecha(p.fecha_inicio)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(p.capital)}</td>
                      <td className="py-2 px-2 text-center">{pagadas}/{p.cantidad_cuotas}</td>
                      <td className="py-2 px-2">
                        <span className={estado.cls}>{estado.label}</span>
                        {p.cobrable_en_local && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">Se cobra en el local</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
