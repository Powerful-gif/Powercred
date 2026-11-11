import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calcularMora } from '../lib/calculos'
import { formatMoneda, formatFecha, hoyArgentina } from '../lib/formatters'
import { numeroPrestamo } from '../lib/prestamosPrivados'
import { usePrestamosPrivados } from '../components/PrestamosPrivados/usePrestamosPrivados'
import FormularioCobro from '../components/PrestamosPrivados/FormularioCobro'

function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function PrestamosCobros() {
  const { prestamos, cargando, error, recargar } = usePrestamosPrivados()
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const hoy = hoyArgentina()

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (error) return <div className="card text-center py-12 text-red-600">{error}</div>

  const pendientes = prestamos
    .filter(p => p.estado !== 'incobrable')
    .flatMap(p => (p.pp_cuotas || []).filter(c => c.estado !== 'pagada').map(c => ({ prestamo: p, cuota: c })))
    .sort((a, b) => a.cuota.fecha_vencimiento.localeCompare(b.cuota.fecha_vencimiento))

  const texto = normalizar(busqueda.trim())
  const visibles = texto
    ? pendientes.filter(({ prestamo: p }) =>
        normalizar(`${p.pp_personas?.nombre} ${p.pp_personas?.apellido} ${p.pp_personas?.dni || ''} ${numeroPrestamo(p.numero)}`).includes(texto))
    : pendientes

  return (
    <div className="space-y-5">
      <div className="card">
        <input
          type="text"
          className="input-field"
          placeholder="Buscar por nombre, DNI o número de préstamo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card">
        {visibles.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No hay cuotas para cobrar{texto ? ' con esa búsqueda' : ''}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Vencimiento</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Persona</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Préstamo</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Cuota</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Saldo</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Punitorio</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ prestamo: p, cuota: c }) => {
                  const saldo = Number(c.importe_original) - Number(c.importe_pagado)
                  const { mora } = calcularMora(saldo, c.fecha_vencimiento, Number(p.tasa_mora_diaria))
                  const vencida = c.fecha_vencimiento < hoy
                  return (
                    <tr key={c.id} className={`border-b border-gray-100 ${vencida ? 'bg-red-50' : ''}`}>
                      <td className={`py-2 px-2 ${vencida ? 'text-red-600 font-semibold' : ''}`}>{formatFecha(c.fecha_vencimiento)}</td>
                      <td className="py-2 px-2 font-medium">{p.pp_personas?.apellido}, {p.pp_personas?.nombre}</td>
                      <td className="py-2 px-2 font-mono text-xs">
                        <Link to={`/prestamos-privados/${p.id}`} className="text-blue-700 hover:underline">{numeroPrestamo(p.numero)}</Link>
                      </td>
                      <td className="py-2 px-2 text-center">{c.numero_cuota}/{p.cantidad_cuotas}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(saldo)}</td>
                      <td className="py-2 px-2 text-right text-orange-600">{mora > 0 ? formatMoneda(mora) : '-'}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => setSeleccion({ prestamo: p, cuota: c })} className="text-blue-600 hover:underline text-xs font-medium">
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {seleccion && (
          <>
            <div className="mt-4 text-sm text-gray-600">
              {seleccion.prestamo.pp_personas?.apellido}, {seleccion.prestamo.pp_personas?.nombre} · {numeroPrestamo(seleccion.prestamo.numero)}
            </div>
            <FormularioCobro
              key={seleccion.cuota.id}
              prestamo={seleccion.prestamo}
              cuota={seleccion.cuota}
              onCobrado={() => { setSeleccion(null); recargar() }}
              onCancelar={() => setSeleccion(null)}
            />
          </>
        )}
      </div>
    </div>
  )
}
