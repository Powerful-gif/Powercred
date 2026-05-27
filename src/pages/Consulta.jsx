import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { calcularCuota } from '../lib/calculos'
import { formatMoneda } from '../lib/formatters'

const PLANES = {
  mensual:   [3, 6, 9, 12],
  quincenal: [4, 6, 8, 10, 12],
  semanal:   [4, 8, 12, 16, 20, 24],
}

export default function Consulta() {
  const { getTasa } = useConfig()
  const [precio, setPrecio] = useState('')
  const [modoEntrega, setModoEntrega] = useState('0')
  const [pctCustom, setPctCustom] = useState('')

  const pct = modoEntrega === 'custom' ? (parseFloat(pctCustom) || 0) : parseFloat(modoEntrega)
  const precioNum = parseFloat(precio) || 0
  const entrega = Math.round(precioNum * pct / 100)
  const aFinanciar = Math.max(0, precioNum - entrega)

  function getTasaColchones(n, peri) {
    const meses = peri === 'mensual' ? n : peri === 'quincenal' ? n * 0.5 : n / 4.33
    if (meses <= 6) return 0
    if (peri === 'mensual') return n === 9 ? 18 : n === 12 ? 24 : getTasa('hogar', peri, n)
    return getTasa('hogar', peri, n)
  }

  function calcFila(importe, peri, n) {
    const tasaGen = getTasa('hogar', peri, n)
    const tasaCol = getTasaColchones(n, peri)
    const { cuota: cuotaGen } = calcularCuota(importe, tasaGen, n)
    const { cuota: cuotaCol } = calcularCuota(importe, tasaCol, n)
    return { tasaGen, cuotaGen, tasaCol, cuotaCol }
  }

  const hayImporte = aFinanciar > 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Entrada de datos */}
      <div className="card space-y-5">
        <h2 className="font-bold text-gray-800 text-lg">Calculadora de Financiación</h2>

        {/* Precio */}
        <div>
          <label className="label">Precio del artículo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              className="input-field pl-8 text-2xl font-bold"
              placeholder="0"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              min="0"
            />
          </div>
        </div>

        {/* Entrega */}
        <div>
          <label className="label mb-2">Entrega inicial</label>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { val: '0',      label: 'Sin entrega' },
              { val: '20',     label: '20%' },
              { val: '30',     label: '30%' },
              { val: 'custom', label: 'Otra %' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setModoEntrega(val)}
                className={`px-5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  modoEntrega === val
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
            {modoEntrega === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="input-field w-20 text-sm"
                  placeholder="Ej: 25"
                  value={pctCustom}
                  onChange={e => setPctCustom(e.target.value)}
                  min="0" max="100"
                />
                <span className="text-gray-500 text-sm font-medium">%</span>
              </div>
            )}
          </div>

          {/* Resumen entrega */}
          {precioNum > 0 && (
            <div className="flex flex-wrap gap-6 mt-4 p-4 bg-gray-50 rounded-xl">
              {pct > 0 && (
                <div>
                  <div className="text-xs text-gray-500">Entrega ({pct}%)</div>
                  <div className="font-bold text-gray-900 text-lg">{formatMoneda(entrega)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Monto a financiar</div>
                <div className="font-bold text-orange-700 text-2xl">{formatMoneda(aFinanciar)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tablas de cuotas */}
      {hayImporte && Object.entries(PLANES).map(([peri, opciones]) => (
        <div key={peri} className="card">
          <h3 className="font-bold text-gray-800 mb-4 capitalize text-base">{peri}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium text-xs w-24">Cuotas</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-semibold" colSpan={2}>
                    General
                  </th>
                  <th className="text-center py-2 px-3 text-gray-600 font-semibold border-l-2 border-gray-100" colSpan={2}>
                    Colchones y Sillones
                  </th>
                </tr>
                <tr className="border-b-2 border-gray-200">
                  <th className="pb-2 px-3"></th>
                  <th className="pb-2 px-3 text-xs text-gray-400 font-normal text-center">Tasa</th>
                  <th className="pb-2 px-3 text-xs text-gray-400 font-normal text-center">Cuota / mes</th>
                  <th className="pb-2 px-3 text-xs text-gray-400 font-normal text-center border-l-2 border-gray-100">Tasa</th>
                  <th className="pb-2 px-3 text-xs text-gray-400 font-normal text-center">Cuota / mes</th>
                </tr>
              </thead>
              <tbody>
                {opciones.map(n => {
                  const { tasaGen, cuotaGen, tasaCol, cuotaCol } = calcFila(aFinanciar, peri, n)
                  return (
                    <tr key={n} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-gray-700">{n} cuotas</td>
                      <td className="py-3 px-3 text-center text-gray-400 text-xs">{tasaGen}%</td>
                      <td className="py-3 px-3 text-center font-bold text-gray-900 text-base">
                        {formatMoneda(cuotaGen)}
                      </td>
                      <td className="py-3 px-3 text-center text-xs border-l-2 border-gray-100">
                        {tasaCol === 0
                          ? <span className="text-green-600 font-semibold">sin interés</span>
                          : <span className="text-gray-400">{tasaCol}%</span>
                        }
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-green-700 text-base">
                        {formatMoneda(cuotaCol)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!precioNum && (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🧮</div>
          <div className="font-medium">Ingresá el precio del artículo para ver las opciones de financiación</div>
        </div>
      )}
    </div>
  )
}
