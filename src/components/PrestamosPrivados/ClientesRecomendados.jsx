import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatMoneda, hoyArgentina } from '../../lib/formatters'
import { recomendarClientes } from '../../lib/prestamosPrivados'

const TAMANIO_PAGINA = 1000

// Supabase devuelve como máximo 1000 filas por consulta
async function traerTodo(tabla, columnas) {
  const filas = []
  for (let desde = 0; ; desde += TAMANIO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order('id')
      .range(desde, desde + TAMANIO_PAGINA - 1)
    if (error) throw error
    filas.push(...data)
    if (data.length < TAMANIO_PAGINA) return filas
  }
}

export default function ClientesRecomendados() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      traerTodo('creditos', 'id, cliente_id, estado, importe_original, clientes(nombre, apellido, celular, localidad)'),
      traerTodo('cuotas', 'id, credito_id, estado, fecha_vencimiento'),
      traerTodo('pagos', 'id, cuota_id, fecha_pago'),
    ])
      .then(([creditos, cuotas, pagos]) => setLista(recomendarClientes(creditos, cuotas, pagos, hoyArgentina())))
      .catch(() => setError(true))
  }, [])

  if (error) return <div className="card text-center py-12 text-red-600">No se pudieron cargar los clientes.</div>
  if (!lista) return <div className="text-center py-12 text-gray-400">Analizando clientes...</div>

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800">A quién prestarle</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Clientes del sistema común al día y sin atrasos graves, de mejor a peor. Requiere al menos 3 cuotas pagadas,
        ninguna con más de 30 días de atraso y nada vencido hoy. Se cuenta "en fecha" hasta 3 días después del vencimiento.
      </p>
      {lista.length === 0 ? (
        <p className="text-center py-8 text-gray-400">Ningún cliente cumple las condiciones.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Cliente</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Celular</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Pagó en fecha</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Peor atraso</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Cancelados</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Activos</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Mayor crédito pagado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 px-2 font-medium">
                    {r.cliente.apellido}, {r.cliente.nombre}
                    {r.cliente.localidad && <div className="text-xs text-gray-400">{r.cliente.localidad}</div>}
                  </td>
                  <td className="py-2 px-2">{r.cliente.celular}</td>
                  <td className="py-2 px-2 text-right font-semibold text-green-700">
                    {Math.round(r.porcentajeEnFecha)}% <span className="text-xs text-gray-400 font-normal">({r.enFecha}/{r.cuotasPagadas})</span>
                  </td>
                  <td className="py-2 px-2 text-right">{r.atrasoMaximo} días</td>
                  <td className="py-2 px-2 text-center">{r.cancelados}</td>
                  <td className="py-2 px-2 text-center">{r.activos}</td>
                  <td className="py-2 px-2 text-right">{r.mayorCancelado > 0 ? formatMoneda(r.mayorCancelado) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
