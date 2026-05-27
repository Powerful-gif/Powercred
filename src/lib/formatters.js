// Formatea moneda en formato argentino: $1.234.567,89
export function formatMoneda(valor) {
  if (valor === null || valor === undefined || valor === '') return '$0,00'
  const num = parseFloat(valor)
  if (isNaN(num)) return '$0,00'
  return '$' + num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// Formatea fecha DD/MM/YYYY
export function formatFecha(fecha) {
  if (!fecha) return '-'
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Formatea fecha larga: "15 de enero de 2024"
export function formatFechaLarga(fecha) {
  if (!fecha) return '-'
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Nombre del mes en español
export function nombreMes(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { month: 'long' })
}

// Porcentaje con 2 decimales
export function formatPorcentaje(valor) {
  if (valor === null || valor === undefined) return '0,00%'
  return parseFloat(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + '%'
}

// Convierte número a texto en español (para el pagaré)
export function numeroALetras(numero) {
  const entero = Math.floor(numero)
  const decimales = Math.round((numero - entero) * 100)

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  function convertirMiles(n) {
    if (n === 0) return ''
    if (n < 30) return unidades[n]
    if (n < 100) {
      const dec = Math.floor(n / 10)
      const uni = n % 10
      return decenas[dec] + (uni > 0 ? ' Y ' + unidades[uni] : '')
    }
    if (n === 100) return 'CIEN'
    if (n < 1000) {
      const cen = Math.floor(n / 100)
      const resto = n % 100
      return centenas[cen] + (resto > 0 ? ' ' + convertirMiles(resto) : '')
    }
    if (n < 2000) return 'MIL' + (n % 1000 > 0 ? ' ' + convertirMiles(n % 1000) : '')
    if (n < 1000000) {
      const miles = Math.floor(n / 1000)
      const resto = n % 1000
      return convertirMiles(miles) + ' MIL' + (resto > 0 ? ' ' + convertirMiles(resto) : '')
    }
    if (n < 2000000) return 'UN MILLÓN' + (n % 1000000 > 0 ? ' ' + convertirMiles(n % 1000000) : '')
    const millones = Math.floor(n / 1000000)
    const resto = n % 1000000
    return convertirMiles(millones) + ' MILLONES' + (resto > 0 ? ' ' + convertirMiles(resto) : '')
  }

  const parteEntera = convertirMiles(entero) || 'CERO'
  const centavos = decimales > 0 ? ` CON ${decimales}/100` : ' CON 00/100'
  return parteEntera + centavos + ' PESOS'
}

// Hoy en Argentina (YYYY-MM-DD)
export function hoyArgentina() {
  const ahora = new Date()
  const offsetArg = -3 * 60
  const offsetLocal = ahora.getTimezoneOffset()
  const diff = (offsetLocal - offsetArg) * 60000
  const argDate = new Date(ahora.getTime() + diff)
  const y = argDate.getFullYear()
  const m = String(argDate.getMonth() + 1).padStart(2, '0')
  const d = String(argDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Días de diferencia entre dos fechas YYYY-MM-DD
export function diasEntre(fechaDesde, fechaHasta) {
  const d1 = new Date(fechaDesde + 'T12:00:00')
  const d2 = new Date(fechaHasta + 'T12:00:00')
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))
}

// Obtener celular para WhatsApp (Argentina: 549 + número sin 0)
export function celularWhatsApp(celular) {
  if (!celular) return ''
  let num = celular.replace(/\D/g, '')
  if (num.startsWith('0')) num = num.substring(1)
  if (num.startsWith('54')) return num
  return '549' + num
}
