import { hoyArgentina, diasEntre } from './formatters'

// ============================================================
// CÁLCULO DE CUOTAS (sistema de amortización directo)
// ============================================================

export function calcularCuota(importe, tasaPorcentaje, cantidadCuotas) {
  const total = importe * (1 + tasaPorcentaje / 100)
  const cuota = total / cantidadCuotas
  return { total: Math.round(total * 100) / 100, cuota: Math.round(cuota * 100) / 100 }
}

// TEA usando IRR (Newton-Raphson)
export function calcularTEA(importe, cuota, nCuotas, periodicidad) {
  if (importe <= 0 || cuota <= 0 || nCuotas <= 0) return 0
  let rate = 0.05
  for (let i = 0; i < 200; i++) {
    let pv = 0
    let dpv = 0
    for (let t = 1; t <= nCuotas; t++) {
      const factor = Math.pow(1 + rate, t)
      pv += cuota / factor
      dpv -= t * cuota / (factor * (1 + rate))
    }
    const f = pv - importe
    if (Math.abs(f) < 0.001) break
    rate = rate - f / dpv
    if (rate < 0) rate = 0.001
  }
  const periodsPerYear = periodicidad === 'mensual' ? 12 : 52
  const tea = Math.pow(1 + rate, periodsPerYear) - 1
  return Math.round(tea * 10000) / 100 // como porcentaje con 2 decimales
}

// CFT = TEA (sin gastos adicionales)
export function calcularCFT(tea) {
  return tea
}

// ============================================================
// GENERACIÓN DE FECHAS DE CUOTAS
// ============================================================

// Evitar sábado (6) y domingo (0)
function ajustarFinDeSemana(fecha) {
  const d = new Date(fecha + 'T12:00:00')
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() + 2) // sábado → lunes
  if (dow === 0) d.setDate(d.getDate() + 1) // domingo → lunes
  return d.toISOString().split('T')[0]
}

// Siguiente viernes a partir de una fecha
function siguienteViernes(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  const dow = d.getDay() // 0=dom, 5=vie
  const diasHastaViernes = (5 - dow + 7) % 7 || 7
  d.setDate(d.getDate() + diasHastaViernes)
  return d.toISOString().split('T')[0]
}

// Calcular fecha de primer vencimiento según periodicidad
export function calcularPrimerVencimiento(fechaInicio, periodicidad) {
  const d = new Date(fechaInicio + 'T12:00:00')
  if (periodicidad === 'mensual') {
    // Día 10 del mes siguiente
    const mes = d.getMonth() + 1
    const anio = mes === 12 ? d.getFullYear() + 1 : d.getFullYear()
    const mesNext = mes === 12 ? 1 : mes + 1
    const fecha = `${anio}-${String(mesNext).padStart(2, '0')}-10`
    return ajustarFinDeSemana(fecha)
  } else {
    // Viernes de la semana siguiente
    return siguienteViernes(fechaInicio)
  }
}

// Generar todas las fechas de vencimiento
export function generarFechasVencimiento(primerVencimiento, cantidadCuotas, periodicidad) {
  const fechas = []
  let fechaActual = primerVencimiento

  for (let i = 0; i < cantidadCuotas; i++) {
    if (i === 0) {
      fechas.push(fechaActual)
      continue
    }
    const d = new Date(fechaActual + 'T12:00:00')
    if (periodicidad === 'mensual') {
      d.setMonth(d.getMonth() + 1)
      const fecha = d.toISOString().split('T')[0]
      fechaActual = ajustarFinDeSemana(fecha)
    } else {
      d.setDate(d.getDate() + 7)
      fechaActual = d.toISOString().split('T')[0]
    }
    fechas.push(fechaActual)
  }
  return fechas
}

// ============================================================
// CÁLCULO DE MORA
// ============================================================

export function calcularMora(importeCuota, fechaVencimiento, tasaDiaria = 0.3) {
  const hoy = hoyArgentina()
  if (fechaVencimiento >= hoy) return { dias: 0, mora: 0, total: importeCuota }
  const dias = diasEntre(fechaVencimiento, hoy)
  const mora = Math.round(dias * (tasaDiaria / 100) * importeCuota * 100) / 100
  return { dias, mora, total: Math.round((importeCuota + mora) * 100) / 100 }
}

// ============================================================
// ESTADO DEL CRÉDITO
// ============================================================

export function calcularEstadoCredito(cuotas, estadoActual) {
  if (estadoActual === 'incobrable' || estadoActual === 'cancelado') return estadoActual

  const hoy = hoyArgentina()
  const pendientes = cuotas.filter(c => c.estado !== 'pagada')

  if (pendientes.length === 0) return 'cancelado'

  let maxDiasAtraso = 0
  for (const cuota of pendientes) {
    if (cuota.fecha_vencimiento < hoy) {
      const dias = diasEntre(cuota.fecha_vencimiento, hoy)
      if (dias > maxDiasAtraso) maxDiasAtraso = dias
    }
  }

  if (maxDiasAtraso === 0) return 'activo'
  if (maxDiasAtraso <= 30) return 'atrasado'
  return 'mora'
}

// ============================================================
// CAPACIDAD DE PAGO
// ============================================================

export function calcularCapacidadDisponible(capacidadTotal, creditosActivos) {
  if (!capacidadTotal) return null
  const comprometido = creditosActivos.reduce((acc, cred) => {
    if (cred.periodicidad === 'mensual') {
      return acc + cred.importe_cuota
    } else {
      return acc + cred.importe_cuota * 4.33
    }
  }, 0)
  return {
    total: capacidadTotal,
    comprometido: Math.round(comprometido * 100) / 100,
    disponible: Math.round((capacidadTotal - comprometido) * 100) / 100
  }
}
