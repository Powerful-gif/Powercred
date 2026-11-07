import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatMoneda, formatFecha } from '../lib/formatters'
import { numeroPrestamo, resumirCartera, resumirPrestamo } from '../lib/prestamosPrivados'

export const ESTADOS_PRESTAMO = {
  activo: { cls: 'badge-activo', label: 'Al día' },
  atrasado: { cls: 'badge-atrasado', label: 'Atrasado' },
  mora: { cls: 'badge-mora', label: 'En mora' },
  incobrable: { cls: 'badge-incobrable', label: 'Incobrable' },
  cancelado: { cls: 'badge-cancelado', label: 'Cancelado' },
}

function Dato({ titulo, valor, detalle, color = 'text-gray-900' }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{titulo}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{valor}</div>
      {detalle && <div className="text-xs text-gray-400 mt-1">{detalle}</div>}
    </div>
  )
}

function formatPorciento(valor) {
  if (valor === null || valor === undefined) return '-'
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function colorResultado(valor) {
  return valor === null || valor >= 0 ? 'text-green-700' : 'text-red-600'
}

export default function PrestamosPrivados() {
  const [prestamos, setPrestamos] = useState([])
  const [prestamistas, setPrestamistas] = useState([])
  const [serie, setSerie] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorInflacion, setErrorInflacion] = useState(false)

  useEffect(() => {
    cargar()
    fetch('/api/inflacion')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => setSerie(data.serie))
      .catch(() => setErrorInflacion(true))
  }, [])

  async function cargar() {
    setCargando(true)
    const [resPrestamos, resPrestamistas] = await Promise.all([
      supabase
        .from('pp_prestamos')
        .select('*, pp_personas(nombre, apellido), pp_prestamistas(nombre), pp_cuotas(*), pp_pagos(*)')
        .order('numero', { ascending: false }),
      supabase.from('pp_prestamistas').select('*').order('nombre'),
    ])
    if (resPrestamos.error || resPrestamistas.error) {
      setError('No se pudieron cargar los préstamos.')
    } else {
      setPrestamos(resPrestamos.data)
      setPrestamistas(resPrestamistas.data)
    }
    setCargando(false)
  }

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (error) return <div className="card text-center py-12 text-red-600">{error}</div>

  const visibles = filtro === 'todos' ? prestamos : prestamos.filter(p => p.prestamista_id === filtro)
  const cartera = resumirCartera(visibles, serie)
  const ultimoIpc = serie?.[serie.length - 1]?.mes.split('-').reverse().join('/')
  const perdidaInflacion = cartera.resultadoReal === null ? null : cartera.resultadoNominal - cartera.resultadoReal

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[{ id: 'todos', nombre: 'Todos' }, ...prestamistas].map(p => (
          <button
            key={p.id}
            onClick={() => setFiltro(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === p.id ? 'bg-blue-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Dato titulo="Total prestado" valor={formatMoneda(cartera.capitalPrestado)} detalle={`${cartera.cantidad} préstamo(s)`} />
        <Dato titulo="Capital en la calle" valor={formatMoneda(cartera.capitalEnLaCalle)} detalle="Falta que vuelva" color="text-blue-800" />
        <Dato
          titulo="Ganancia cobrada"
          valor={formatMoneda(cartera.gananciaCobrada)}
          detalle={`Intereses ${formatMoneda(cartera.interesCobrado)} + punitorios ${formatMoneda(cartera.moraCobrada)}`}
          color="text-green-700"
        />
        <Dato titulo="Intereses por cobrar" valor={formatMoneda(cartera.interesPorCobrar)} detalle="Todavía no entraron" />
      </div>

      {cartera.capitalIncobrable > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Capital perdido en préstamos incobrables: <strong>{formatMoneda(cartera.capitalIncobrable)}</strong>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-800">Comparación con la inflación</h3>
        {errorInflacion ? (
          <p className="text-sm text-red-600 mt-2">No se pudo obtener la inflación. Probá recargar en un rato.</p>
        ) : !serie ? (
          <p className="text-sm text-gray-400 mt-2">Cargando inflación...</p>
        ) : cartera.resultadoReal === null ? (
          <p className="text-sm text-gray-400 mt-2">Todavía no hay préstamos para comparar.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-sm text-gray-500">Ganancia real</div>
                <div className={`text-2xl font-bold mt-1 ${colorResultado(cartera.resultadoReal)}`}>
                  {formatMoneda(cartera.resultadoReal)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Ya descontada la inflación</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Rendimiento real</div>
                <div className={`text-2xl font-bold mt-1 ${colorResultado(cartera.rendimientoReal)}`}>
                  {formatPorciento(cartera.rendimientoReal)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Sobre lo prestado, en pesos de hoy</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Inflación del período</div>
                <div className="text-2xl font-bold mt-1 text-gray-900">{formatPorciento(cartera.inflacionPeriodo)}</div>
                <div className="text-xs text-gray-400 mt-1">Desde el primer préstamo</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Se comió la inflación</div>
                <div className="text-2xl font-bold mt-1 text-orange-600">{formatMoneda(perdidaInflacion)}</div>
                <div className="text-xs text-gray-400 mt-1">Diferencia contra la ganancia en pesos</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Cada préstamo y cada cobro se lleva a pesos de hoy con el IPC del mes en que ocurrió (INDEC, hasta {ultimoIpc}).
              El capital que sigue en la calle se cuenta por su valor actual y los intereses futuros no se cuentan.
            </p>
          </>
        )}
      </div>

      {filtro === 'todos' && prestamistas.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Por persona que presta</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Quién prestó</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Prestado</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">En la calle</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Ganancia cobrada</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Ganancia real</th>
                </tr>
              </thead>
              <tbody>
                {prestamistas.map(persona => {
                  const r = resumirCartera(prestamos.filter(p => p.prestamista_id === persona.id), serie)
                  return (
                    <tr key={persona.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{persona.nombre}</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(r.capitalPrestado)}</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(r.capitalEnLaCalle)}</td>
                      <td className="py-2 px-2 text-right">{formatMoneda(r.gananciaCobrada)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${colorResultado(r.resultadoReal)}`}>
                        {r.resultadoReal === null ? '-' : formatMoneda(r.resultadoReal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Préstamos</h3>
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
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Capital</th>
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
                      <td className="py-2 px-2">{p.pp_prestamistas?.nombre}</td>
                      <td className="py-2 px-2">{formatFecha(p.fecha_inicio)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatMoneda(p.capital)}</td>
                      <td className="py-2 px-2 text-center">{pagadas}/{p.cantidad_cuotas}</td>
                      <td className="py-2 px-2"><span className={estado.cls}>{estado.label}</span></td>
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
