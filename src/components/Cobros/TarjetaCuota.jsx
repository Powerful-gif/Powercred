import { useState, useEffect } from 'react'
import { formatMoneda, formatFecha, hoyArgentina } from '../../lib/formatters'

const METODOS = [
  { key: 'efectivo', label: '💵 Efectivo' },
  { key: 'transferencia', label: '🏦 Transferencia' },
  { key: 'tarjeta', label: '💳 Tarjeta' },
]

export default function TarjetaCuota({ cuota, credito, onCobrar, cobrando, exitoId }) {
  const hoy = hoyArgentina()
  const mora = cuota.moraCalculada
  const vencida = cuota.fecha_vencimiento < hoy
  const enMora = mora.dias > 30
  const yaEsCobrado = exitoId === cuota.id

  const saldoRestante = cuota.importe_original - (cuota.importe_pagado || 0)
  const tienePagosParciales = (cuota.importe_pagado || 0) > 0

  const [metodo, setMetodo] = useState('efectivo')
  const [confirmando, setConfirmando] = useState(false)
  const [montoPago, setMontoPago] = useState('')

  useEffect(() => {
    if (confirmando) {
      setMontoPago(mora.total.toFixed(2))
    }
  }, [confirmando, mora.total])

  const montoNum = parseFloat(montoPago) || 0
  const esParcial = montoNum < mora.total && montoNum > 0
  const esValido = montoNum > 0 && montoNum <= mora.total

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      yaEsCobrado
        ? 'border-green-300 bg-green-50'
        : vencida
          ? enMora ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
          : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Encabezado cuota */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-gray-800">
              Cuota {cuota.numero_cuota}/{credito.cantidad_cuotas}
            </span>
            {!vencida && <span className="badge-activo">Al día</span>}
            {vencida && !enMora && <span className="badge-atrasado">Vencida ({mora.dias} días)</span>}
            {vencida && enMora && <span className="badge-mora">En mora ({mora.dias} días)</span>}
            {tienePagosParciales && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Pago parcial registrado
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500">
            Vencimiento: {formatFecha(cuota.fecha_vencimiento)}
            {credito.cobrador && ` · Cobrador: ${credito.cobrador}`}
          </div>

          {/* Desglose */}
          <div className="mt-2 text-xs space-y-0.5">
            {tienePagosParciales && (
              <div className="text-blue-600">
                Ya pagado: <span className="font-semibold">{formatMoneda(cuota.importe_pagado)}</span>
              </div>
            )}
            <div className="text-gray-600">
              Saldo capital: <span className="font-semibold">{formatMoneda(saldoRestante)}</span>
            </div>
            {mora.mora > 0 && (
              <div className="text-orange-600">
                Punitorio ({mora.dias} días × 0.3% sobre saldo): <span className="font-semibold">{formatMoneda(mora.mora)}</span>
              </div>
            )}
          </div>

          {/* Panel de cobro */}
          {!yaEsCobrado && confirmando && (
            <div className="mt-3 space-y-3">
              {/* Monto a cobrar */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  ¿Cuánto paga? (máximo {formatMoneda(mora.total)})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                  <input
                    type="number"
                    className="w-full border-2 border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-orange-400"
                    value={montoPago}
                    onChange={e => setMontoPago(e.target.value)}
                    min="0.01"
                    max={mora.total}
                    step="0.01"
                  />
                </div>
                {esParcial && (
                  <div className="text-xs text-orange-600 mt-1">
                    ⚠ Pago parcial. Quedará pendiente: {formatMoneda(mora.total - montoNum)} (el punitorio seguirá corriendo sobre el saldo)
                  </div>
                )}
              </div>

              {/* Método de pago */}
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Forma de pago:</div>
                <div className="flex gap-2 flex-wrap">
                  {METODOS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setMetodo(m.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                        metodo === m.key
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botones y total */}
        <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
          <div>
            <div className={`text-xs mb-0.5 ${vencida ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              TOTAL A COBRAR
            </div>
            <div className={`text-2xl font-black ${vencida ? 'text-red-600' : 'text-blue-800'}`}>
              {formatMoneda(mora.total)}
            </div>
          </div>

          {!yaEsCobrado ? (
            !confirmando ? (
              <button
                onClick={() => setConfirmando(true)}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors min-w-28"
              >
                COBRAR
              </button>
            ) : (
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={() => { if (esValido) { onCobrar(metodo, montoNum); setConfirmando(false) } }}
                  disabled={cobrando || !esValido}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 min-w-28"
                >
                  {cobrando ? 'Procesando...' : '✓ CONFIRMAR'}
                </button>
                <button onClick={() => setConfirmando(false)} className="text-gray-400 text-xs hover:text-gray-600">
                  Cancelar
                </button>
              </div>
            )
          ) : (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-medium text-sm">
              ✓ Cobrado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
