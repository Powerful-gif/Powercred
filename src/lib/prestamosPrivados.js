import { calcularCuota, calcularEstadoCredito } from './calculos'

const redondear = n => Math.round(n * 100) / 100

// La última cuota absorbe la diferencia de centavos del redondeo, para que la
// suma de las cuotas dé exactamente el total a cobrar.
export function armarCuotas(capital, tasa, fechas) {
  const { total, cuota } = calcularCuota(capital, tasa, fechas.length)
  const ultima = redondear(total - cuota * (fechas.length - 1))
  return {
    total,
    importeCuota: cuota,
    cuotas: fechas.map((fecha, i) => ({
      numero_cuota: i + 1,
      fecha_vencimiento: fecha,
      importe_original: i === fechas.length - 1 ? ultima : cuota,
    })),
  }
}

export function numeroPrestamo(numero) {
  return `PRIV-${String(numero).padStart(4, '0')}`
}

export function indiceDeFecha(serie, fecha) {
  const mes = fecha.slice(0, 7)
  if (mes <= serie[0].mes) return serie[0].indice
  const ultimo = serie[serie.length - 1]
  if (mes >= ultimo.mes) return ultimo.indice
  return (serie.find(s => s.mes === mes) || ultimo).indice
}

// Cada pago de cuota se reparte entre capital e interés en la misma proporción
// que el préstamo completo. El punitorio se cuenta entero como ganancia.
export function resumirPrestamo(prestamo) {
  const capital = Number(prestamo.capital)
  const total = Number(prestamo.total_con_intereses)
  const pagos = prestamo.pp_pagos || []
  const cobradoCuotas = pagos.reduce((s, p) => s + Number(p.importe), 0)
  const moraCobrada = pagos.reduce((s, p) => s + Number(p.mora), 0)
  const capitalRecuperado = total > 0 ? cobradoCuotas * (capital / total) : 0
  const interesCobrado = cobradoCuotas - capitalRecuperado
  return {
    capital,
    capitalRecuperado,
    capitalPendiente: Math.max(0, capital - capitalRecuperado),
    interesCobrado,
    interesPendiente: Math.max(0, total - capital - interesCobrado),
    moraCobrada,
    cobradoCuotas,
    estado: calcularEstadoCredito(prestamo.pp_cuotas || [], prestamo.estado),
  }
}

export function resumirCartera(prestamos, serie) {
  const r = {
    cantidad: prestamos.length,
    capitalPrestado: 0,
    capitalEnLaCalle: 0,
    capitalIncobrable: 0,
    interesCobrado: 0,
    interesPorCobrar: 0,
    moraCobrada: 0,
    gananciaCobrada: 0,
    resultadoNominal: 0,
    capitalAjustado: null,
    cobradoAjustado: null,
    resultadoReal: null,
    rendimientoReal: null,
    inflacionPeriodo: null,
  }

  for (const p of prestamos) {
    const d = resumirPrestamo(p)
    r.capitalPrestado += d.capital
    r.interesCobrado += d.interesCobrado
    r.moraCobrada += d.moraCobrada
    if (d.estado === 'incobrable') {
      r.capitalIncobrable += d.capitalPendiente
    } else {
      r.capitalEnLaCalle += d.capitalPendiente
      r.interesPorCobrar += d.interesPendiente
    }
  }
  r.gananciaCobrada = r.interesCobrado + r.moraCobrada
  r.resultadoNominal = r.gananciaCobrada - r.capitalIncobrable

  if (serie?.length && prestamos.length) {
    const base = serie[serie.length - 1].indice
    let capitalAjustado = 0
    let cobradoAjustado = 0
    let primeraFecha = prestamos[0].fecha_inicio
    for (const p of prestamos) {
      capitalAjustado += Number(p.capital) * (base / indiceDeFecha(serie, p.fecha_inicio))
      if (p.fecha_inicio < primeraFecha) primeraFecha = p.fecha_inicio
      for (const pago of (p.pp_pagos || [])) {
        const cobrado = Number(pago.importe) + Number(pago.mora)
        cobradoAjustado += cobrado * (base / indiceDeFecha(serie, pago.fecha_pago))
      }
    }
    r.capitalAjustado = capitalAjustado
    r.cobradoAjustado = cobradoAjustado
    // Compara en pesos de hoy lo que salió con lo que volvió. El capital que
    // sigue afuera se cuenta por su valor actual; los intereses futuros no se
    // cuentan porque todavía no se cobraron.
    r.resultadoReal = cobradoAjustado + r.capitalEnLaCalle - capitalAjustado
    r.rendimientoReal = capitalAjustado > 0 ? (r.resultadoReal / capitalAjustado) * 100 : null
    r.inflacionPeriodo = (base / indiceDeFecha(serie, primeraFecha) - 1) * 100
  }

  return r
}
