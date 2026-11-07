import { useState } from 'react'
import { formatMoneda } from '../../lib/formatters'
import { inflacionPromedio, interesTotal, mesesDePlazo, simularPrestamo } from '../../lib/prestamosPrivados'

function formatPorciento(valor) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

export default function SimuladorPrestamo({ serie }) {
  const [capital, setCapital] = useState('')
  const [cuotas, setCuotas] = useState('')
  const [interesMensual, setInteresMensual] = useState('')
  const [periodicidad, setPeriodicidad] = useState('mensual')
  const promedio = inflacionPromedio(serie)
  const [inflacionManual, setInflacionManual] = useState(null)

  const inflacionTexto = inflacionManual ?? (promedio === null ? '' : promedio.toFixed(1))
  const capitalNum = parseFloat(capital) || 0
  const cuotasNum = parseInt(cuotas) || 0
  const tasaNum = interesTotal(parseFloat(interesMensual), cuotasNum, periodicidad)
  const inflacionNum = parseFloat(inflacionTexto)
  const listo = capitalNum > 0 && cuotasNum > 0 && tasaNum >= 0 && inflacionNum >= 0
  const r = listo
    ? simularPrestamo({ capital: capitalNum, tasa: tasaNum, cuotas: cuotasNum, periodicidad, inflacionMensual: inflacionNum })
    : null
  const leGana = r && r.gananciaReal >= 0

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Capital a prestar</label>
            <input type="number" className="input-field" placeholder="Ej: 1000000" min="0"
              value={capital} onChange={e => setCapital(e.target.value)} />
          </div>
          <div>
            <label className="label">Periodicidad</label>
            <select className="input-field" value={periodicidad} onChange={e => setPeriodicidad(e.target.value)}>
              <option value="mensual">Mensual</option>
              <option value="quincenal">Quincenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          <div>
            <label className="label">Cantidad de cuotas</label>
            <input type="number" className="input-field" placeholder="Ej: 6" min="1"
              value={cuotas} onChange={e => setCuotas(e.target.value)} />
          </div>
          <div>
            <label className="label">Interés mensual (%)</label>
            <input type="number" className="input-field" placeholder="Ej: 9" min="0" step="0.1"
              value={interesMensual} onChange={e => setInteresMensual(e.target.value)} />
          </div>
          <div>
            <label className="label">Inflación mensual estimada (%)</label>
            <input type="number" className="input-field" min="0" step="0.1"
              value={inflacionTexto} onChange={e => setInflacionManual(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">
              {promedio === null ? 'Cargala a mano.' : `Promedio de los últimos 3 meses: ${formatPorciento(promedio)}. Podés cambiarla.`}
            </div>
          </div>
        </div>
      </div>

      {r && (
        <div className={`card border-2 ${leGana ? 'border-green-300' : 'border-red-300'}`}>
          <div className={`font-semibold ${leGana ? 'text-green-700' : 'text-red-600'}`}>
            {leGana ? 'Le ganaría a la inflación estimada' : 'Perdería contra la inflación estimada'}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-xs text-gray-500">Cuota</div>
              <div className="font-bold text-blue-800 text-xl">{formatMoneda(r.importeCuota)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Ganancia en pesos</div>
              <div className="font-bold text-gray-900 text-xl">{formatMoneda(r.gananciaPesos)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Ganancia real estimada</div>
              <div className={`font-bold text-xl ${leGana ? 'text-green-700' : 'text-red-600'}`}>{formatMoneda(r.gananciaReal)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Rendimiento real</div>
              <div className="font-bold text-gray-900">{formatPorciento(r.rendimientoReal)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Interés total</div>
              <div className="font-bold text-gray-900">{formatPorciento(tasaNum)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Interés mensual mínimo para no perder</div>
              <div className="font-bold text-gray-900">{formatPorciento(r.tasaMinima / mesesDePlazo(cuotasNum, periodicidad))}</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Es una estimación: supone que cobrás todas las cuotas en fecha y que la inflación se mantiene igual.
          </p>
        </div>
      )}
    </div>
  )
}
