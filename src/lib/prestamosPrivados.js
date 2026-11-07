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

function valorizar(prestamos, indiceEn, base) {
  let capitalAjustado = 0
  let cobradoAjustado = 0
  for (const p of prestamos) {
    capitalAjustado += Number(p.capital) * (base / indiceEn(p.fecha_inicio))
    for (const pago of (p.pp_pagos || [])) {
      cobradoAjustado += (Number(pago.importe) + Number(pago.mora)) * (base / indiceEn(pago.fecha_pago))
    }
  }
  return { capitalAjustado, cobradoAjustado }
}

// Último valor publicado hasta esa fecha: el dólar y las tasas no se publican
// fines de semana ni feriados.
export function valorEnFecha(serie, fecha) {
  let izq = 0
  let der = serie.length - 1
  let resultado = serie[0].valor
  while (izq <= der) {
    const medio = Math.floor((izq + der) / 2)
    if (serie[medio].fecha <= fecha) {
      resultado = serie[medio].valor
      izq = medio + 1
    } else {
      der = medio - 1
    }
  }
  return resultado
}

// Compara lo que se tiene hoy prestando contra haber puesto el mismo capital,
// en las mismas fechas, en otra inversión. Cada cobro se supone reinvertido en
// esa alternativa para que las dos opciones se midan igual.
export function compararAlternativa(prestamos, serie) {
  if (!serie?.length || !prestamos.length) return null
  const base = serie[serie.length - 1].valor
  const { capitalAjustado, cobradoAjustado } = valorizar(prestamos, fecha => valorEnFecha(serie, fecha), base)
  const { capitalEnLaCalle } = resumirCartera(prestamos, null)
  const prestando = cobradoAjustado + capitalEnLaCalle
  return { alternativa: capitalAjustado, prestando, diferencia: prestando - capitalAjustado }
}

function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function cuotasPorCobrar(prestamos) {
  const pendientes = []
  for (const p of prestamos) {
    if (p.estado === 'incobrable') continue
    const proporcionCapital = Number(p.capital) / Number(p.total_con_intereses)
    for (const c of (p.pp_cuotas || [])) {
      if (c.estado === 'pagada') continue
      const saldo = Number(c.importe_original) - Number(c.importe_pagado)
      pendientes.push({
        id: c.id,
        prestamoId: p.id,
        numero: numeroPrestamo(p.numero),
        persona: p.pp_personas,
        prestamista: p.pp_prestamistas?.nombre,
        numeroCuota: c.numero_cuota,
        cantidadCuotas: p.cantidad_cuotas,
        fecha: c.fecha_vencimiento,
        saldo,
        capital: saldo * proporcionCapital,
        interes: saldo * (1 - proporcionCapital),
      })
    }
  }
  return pendientes.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function resumirCalendario(pendientes, hoy) {
  const diaSemana = new Date(hoy + 'T12:00:00').getDay()
  const finSemana = sumarDias(hoy, diaSemana === 0 ? 0 : 7 - diaSemana)
  const mes = hoy.slice(0, 7)
  const r = { atrasado: 0, semana: 0, mes: 0, meses: [] }
  const porMes = {}
  for (const c of pendientes) {
    if (c.fecha < hoy) {
      r.atrasado += c.saldo
      continue
    }
    if (c.fecha <= finSemana) r.semana += c.saldo
    if (c.fecha.slice(0, 7) === mes) r.mes += c.saldo
    const clave = c.fecha.slice(0, 7)
    if (!porMes[clave]) porMes[clave] = { mes: clave, total: 0, capital: 0, interes: 0 }
    porMes[clave].total += c.saldo
    porMes[clave].capital += c.capital
    porMes[clave].interes += c.interes
  }
  r.meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes))
  return r
}

export function inflacionPromedio(serie, meses = 3) {
  if (!serie || serie.length <= meses) return null
  const ultimo = serie[serie.length - 1].indice
  const inicial = serie[serie.length - 1 - meses].indice
  return (Math.pow(ultimo / inicial, 1 / meses) - 1) * 100
}

const MESES_POR_CUOTA = { mensual: 1, quincenal: 0.5, semanal: 7 / 30.4375 }

// Lleva cada cuota futura a pesos de hoy con la inflación estimada. Supone
// cuotas iguales y separadas por la periodicidad elegida, desde hoy.
export function simularPrestamo({ capital, tasa, cuotas, periodicidad, inflacionMensual }) {
  const total = capital * (1 + tasa / 100)
  const importeCuota = total / cuotas
  const paso = MESES_POR_CUOTA[periodicidad]
  let factorActual = 0
  for (let k = 1; k <= cuotas; k++) {
    factorActual += Math.pow(1 + inflacionMensual / 100, -k * paso)
  }
  const gananciaReal = importeCuota * factorActual - capital
  return {
    total,
    importeCuota,
    gananciaPesos: total - capital,
    gananciaReal,
    rendimientoReal: (gananciaReal / capital) * 100,
    tasaMinima: (cuotas / factorActual - 1) * 100,
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
    const { capitalAjustado, cobradoAjustado } = valorizar(prestamos, fecha => indiceDeFecha(serie, fecha), base)
    const primeraFecha = prestamos.reduce((min, p) => (p.fecha_inicio < min ? p.fecha_inicio : min), prestamos[0].fecha_inicio)
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
