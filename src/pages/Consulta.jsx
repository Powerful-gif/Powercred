import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { calcularCuota } from '../lib/calculos'
import { formatMoneda } from '../lib/formatters'

const PLANES = {
  mensual:   { label: 'Mensual',   opciones: [3, 6, 9, 12] },
  quincenal: { label: 'Quincenal', opciones: [4, 6, 8, 10, 12] },
  semanal:   { label: 'Semanal',   opciones: [4, 8, 12, 16, 20, 24] },
}

export default function Consulta() {
  const { getTasa, config } = useConfig()
  const [precio, setPrecio] = useState('')
  const [modoEntrega, setModoEntrega] = useState('0')
  const [pctCustom, setPctCustom] = useState('')
  const [rubro, setRubro] = useState('general')
  const [abiertos, setAbiertos] = useState({ mensual: true, quincenal: false, semanal: false })

  const pct = modoEntrega === 'custom' ? null : parseFloat(modoEntrega)
  const precioNum = parseFloat(precio) || 0
  const entrega = modoEntrega === 'custom'
    ? (parseFloat(pctCustom) || 0)
    : Math.round(precioNum * pct / 100)
  const aFinanciar = Math.max(0, precioNum - entrega)
  const hayImporte = aFinanciar > 0

  function toggle(peri) {
    setAbiertos(prev => ({ ...prev, [peri]: !prev[peri] }))
  }

  function getTasaRubro(n, peri) {
    if (rubro === 'general') return getTasa('hogar', peri, n)
    return getTasa('colchones', peri, n)
  }

  function filas(peri, opciones) {
    return opciones.map(n => {
      const tasa = getTasaRubro(n, peri)
      const { cuota } = calcularCuota(aFinanciar, tasa, n)
      return { n, tasa, cuota }
    })
  }

  const rubroLabel = rubro === 'general' ? 'General' : 'Colchones y Sillones'

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── CONTENIDO PARA IMPRIMIR ── */}
      {hayImporte && (
        <div className="print-only">
          <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '600px' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{config.negocio?.nombre || 'POWERFUL'}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>{config.negocio?.direccion} · {config.negocio?.localidad}</div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>
              Opciones de Financiación · {rubroLabel}
            </div>
            <div style={{ display: 'flex', gap: '20px', background: '#f5f5f5', padding: '10px 14px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
              <span><strong>Precio:</strong> {formatMoneda(precioNum)}</span>
              {entrega > 0 && <span><strong>Entrega{pct ? ` (${pct}%)` : ''}:</strong> {formatMoneda(entrega)}</span>}
              <span><strong>Financia:</strong> {formatMoneda(aFinanciar)}</span>
            </div>
            {Object.entries(PLANES)
              .filter(([peri]) => abiertos[peri])
              .map(([peri, { label, opciones }]) => (
                <div key={peri} style={{ marginBottom: '18px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>{label}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #ddd' }}>Cuotas</th>
                        <th style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #ddd' }}>Valor cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas(peri, opciones).map(({ n, cuota }) => (
                        <tr key={n}>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{n} cuotas</td>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                            {formatMoneda(cuota)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── PANTALLA ── */}

      {/* Entrada */}
      <div className="card space-y-5">
        <h2 className="font-bold text-gray-800 text-lg">Calculadora de Financiación</h2>

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

        <div>
          <label className="label mb-2">Entrega inicial</label>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { val: '0', label: 'Sin entrega' },
              { val: '20', label: '20%' },
              { val: '30', label: '30%' },
              { val: 'custom', label: 'Personalizada' },
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
                <span className="text-gray-500 text-sm font-medium">$</span>
                <input
                  type="number"
                  className="input-field w-32 text-sm"
                  placeholder="Monto exacto"
                  value={pctCustom}
                  onChange={e => setPctCustom(e.target.value)}
                  min="0"
                />
              </div>
            )}
          </div>

          {precioNum > 0 && (
            <div className="flex flex-wrap gap-6 mt-4 p-4 bg-gray-50 rounded-xl">
              {entrega > 0 && (
                <div>
                  <div className="text-xs text-gray-500">
                    Entrega{pct ? ` (${pct}%)` : ''}
                  </div>
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

      {/* Rubro */}
      {hayImporte && (
        <div className="card py-4">
          <label className="label mb-3">Rubro</label>
          <div className="flex gap-3">
            {[
              { val: 'general',   label: 'General',              desc: 'Tasas estándar del sistema' },
              { val: 'colchones', label: 'Colchones y Sillones', desc: 'Sin interés hasta 6 meses' },
            ].map(({ val, label, desc }) => (
              <button
                key={val}
                onClick={() => setRubro(val)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-colors ${
                  rubro === val ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secciones desplegables */}
      {hayImporte && Object.entries(PLANES).map(([peri, { label, opciones }]) => (
        <div key={peri} className="card p-0 overflow-hidden">
          <button
            onClick={() => toggle(peri)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-gray-800">{label}</span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${abiertos[peri] ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {abiertos[peri] && (
            <div className="border-t border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-5 text-gray-500 font-medium">Cuotas</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">Tasa</th>
                    <th className="text-center py-2 px-5 text-gray-500 font-medium">Valor por cuota</th>
                  </tr>
                </thead>
                <tbody>
                  {filas(peri, opciones).map(({ n, tasa, cuota }) => (
                    <tr key={n} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                      <td className="py-3 px-5 font-bold text-gray-700">{n} cuotas</td>
                      <td className="py-3 px-3 text-center">
                        {tasa === 0
                          ? <span className="text-green-600 font-semibold text-xs">sin interés</span>
                          : <span className="text-gray-400 text-xs">{tasa}%</span>
                        }
                      </td>
                      <td className="py-3 px-5 text-center font-bold text-gray-900 text-lg">{formatMoneda(cuota)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Imprimir */}
      {hayImporte && (
        <div className="flex justify-center pb-6">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir para el cliente
          </button>
        </div>
      )}

      {!precioNum && (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🧮</div>
          <div className="font-medium">Ingresá el precio del artículo para ver las opciones de financiación</div>
        </div>
      )}
    </div>
  )
}
