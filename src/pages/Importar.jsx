import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generarFechasVencimiento, calcularPrimerVencimiento, calcularEstadoCredito } from '../lib/calculos'

function parsearMonto(str) {
  if (!str || String(str).trim() === '') return 0
  return parseFloat(
    String(str).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim()
  ) || 0
}

function parsearFecha(str) {
  if (!str || String(str).trim() === '') return null
  const limpio = String(str).trim().split(' ')[0]
  if (limpio.includes('-')) return limpio.substring(0, 10)
  const partes = limpio.split('/')
  if (partes.length === 3) {
    const d = partes[0].padStart(2, '0')
    const m = partes[1].padStart(2, '0')
    const y = partes[2].length === 2 ? '20' + partes[2] : partes[2]
    return `${y}-${m}-${d}`
  }
  return null
}

function parsearTasa(str) {
  if (!str) return 0
  return parseFloat(String(str).replace('%', '').replace(',', '.').trim()) || 0
}

function parsearModalidad(str) {
  if (!str) return 'mensual'
  const s = String(str).toLowerCase().trim()
  if (s.includes('quincenal')) return 'quincenal'
  if (s.includes('semanal')) return 'semanal'
  return 'mensual'
}

function parsearEstado(str) {
  if (!str) return 'activo'
  const s = String(str).toLowerCase().trim()
  if (s.includes('atrasado')) return 'atrasado'
  if (s.includes('mora')) return 'mora'
  return 'activo'
}

function parsearCSV(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const filas = []
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue
    const valores = []
    let dentro = false
    let actual = ''
    for (let j = 0; j < linea.length; j++) {
      const c = linea[j]
      if (c === '"') { dentro = !dentro }
      else if (c === ',' && !dentro) { valores.push(actual.trim()); actual = '' }
      else { actual += c }
    }
    valores.push(actual.trim())
    const fila = {}
    headers.forEach((h, j) => { fila[h] = (valores[j] || '').replace(/\r/g, '') })
    filas.push(fila)
  }
  return filas
}

export default function Importar() {
  const [archivoCred, setArchivoCred] = useState(null)
  const [archivoPagos, setArchivoPagos] = useState(null)
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, msg: '' })
  const [resultado, setResultado] = useState(null)
  const [errores, setErrores] = useState([])

  async function ejecutarImport() {
    if (!archivoCred || !archivoPagos) return
    setImportando(true)
    setErrores([])
    setResultado(null)

    const textoCred = await archivoCred.text()
    const textoPagos = await archivoPagos.text()

    const credRows = parsearCSV(textoCred)
    const pagoRows = parsearCSV(textoPagos)

    // Cargar clientes existentes
    const { data: clientes } = await supabase.from('clientes').select('id, dni')
    const clienteByDni = {}
    for (const c of (clientes || [])) clienteByDni[String(c.dni).trim()] = c.id

    // Obtener último número de crédito
    const { data: ultimoCred } = await supabase
      .from('creditos')
      .select('numero_credito')
      .order('created_at', { ascending: false })
      .limit(1)
    let numCredito = 1
    if (ultimoCred && ultimoCred.length > 0) {
      const n = parseInt((ultimoCred[0].numero_credito || '').replace('CRED-', ''))
      if (!isNaN(n)) numCredito = n + 1
    }

    let creditosImportados = 0
    let pagosImportados = 0
    const errs = []
    const creditoMap = {}

    // ── PASO 1: Importar créditos ──
    setProgreso({ actual: 0, total: credRows.length, msg: 'Importando créditos...' })

    for (let i = 0; i < credRows.length; i++) {
      const row = credRows[i]
      const dni = String(row['DNI'] || '').trim()
      const clienteId = clienteByDni[dni]

      if (!clienteId) {
        errs.push(`Crédito fila ${i + 2}: DNI ${dni} no encontrado en clientes`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const fechaInicio = parsearFecha(row['INICIO'])
      if (!fechaInicio) {
        errs.push(`Crédito fila ${i + 2}: Fecha de inicio inválida — "${row['INICIO']}"`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const capital = parsearMonto(row['CAPITAL'])
      const financiado = parsearMonto(row['FINANCIADO'])
      const cantCuotas = parseInt(row['CUOTAS']) || 0
      const importeCuota = parsearMonto(row['CUOTA'])
      const tasa = parsearTasa(row['TASA'])
      const periodicidad = parsearModalidad(row['MODALIDAD'])
      const estado = parsearEstado(row['SITUACION'])

      if (!cantCuotas || !capital) {
        errs.push(`Crédito fila ${i + 2}: CUOTAS o CAPITAL vacío`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const numeroCredito = `CRED-${String(numCredito).padStart(4, '0')}`
      numCredito++

      const primerVenc = calcularPrimerVencimiento(fechaInicio, periodicidad)

      const { data: credData, error: credErr } = await supabase
        .from('creditos')
        .insert({
          numero_credito: numeroCredito,
          cliente_id: clienteId,
          tipo: 'hogar',
          importe_original: capital,
          tasa_interes_porcentaje: tasa,
          tasa_efectiva_anual: 0,
          costo_financiero_total: 0,
          total_con_intereses: financiado,
          cantidad_cuotas: cantCuotas,
          periodicidad,
          importe_cuota: importeCuota,
          fecha_inicio: fechaInicio,
          fecha_primer_vencimiento: primerVenc,
          estado,
          vendedor: null,
          cobrador: null,
          observaciones: null
        })
        .select()
        .single()

      if (credErr) {
        errs.push(`Crédito fila ${i + 2} (DNI ${dni}): ${credErr.message}`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      // Generar cuotas
      const fechas = generarFechasVencimiento(primerVenc, cantCuotas, periodicidad)
      const cuotas = fechas.map((fecha, idx) => ({
        credito_id: credData.id,
        numero_cuota: idx + 1,
        fecha_vencimiento: fecha,
        importe_original: importeCuota,
        estado: 'pendiente',
        total_cobrado: 0
      }))

      const { data: cuotasData, error: cuotasErr } = await supabase
        .from('cuotas')
        .insert(cuotas)
        .select()

      if (cuotasErr) {
        errs.push(`Cuotas de CRED ${numeroCredito}: ${cuotasErr.message}`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const cuotaByNum = {}
      for (const cq of (cuotasData || [])) cuotaByNum[cq.numero_cuota] = cq
      creditoMap[`${dni}_${fechaInicio}`] = { credito: credData, cuotaByNum, clienteId }

      creditosImportados++
      setProgreso({ actual: i + 1, total: credRows.length, msg: `Importando créditos... ${i + 1}/${credRows.length}` })
    }

    // ── PASO 2: Importar pagos ──
    setProgreso({ actual: 0, total: pagoRows.length, msg: 'Importando pagos...' })

    for (let i = 0; i < pagoRows.length; i++) {
      const row = pagoRows[i]
      const dni = String(row['DNI'] || '').trim()
      const fechaInicio = parsearFecha(row['Fecha Inicio'])
      const key = `${dni}_${fechaInicio}`
      const entry = creditoMap[key]

      if (!entry) {
        errs.push(`Pago fila ${i + 2}: No se encontró crédito para DNI ${dni} / inicio ${fechaInicio}`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const numCuotaRaw = row['N°'] || row['N'] || row['Nro'] || row['NUMERO'] || ''
      const numeroCuota = parseInt(numCuotaRaw) || 0
      const cuota = entry.cuotaByNum[numeroCuota]

      if (!cuota) {
        errs.push(`Pago fila ${i + 2}: Cuota N°${numeroCuota} no encontrada en crédito de DNI ${dni}`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      const fechaPago = parsearFecha(row['Fecha Cobro'])
      const cobrado = parsearMonto(row['Cobrado'])
      const cuotaBase = parsearMonto(row['Cuota'])
      const mora = Math.max(0, Math.round((cobrado - cuotaBase) * 100) / 100)

      if (!fechaPago || cobrado <= 0) {
        errs.push(`Pago fila ${i + 2}: Fecha o monto inválido`)
        setProgreso(p => ({ ...p, actual: i + 1 }))
        continue
      }

      await supabase
        .from('cuotas')
        .update({ estado: 'pagada', total_cobrado: cobrado })
        .eq('id', cuota.id)

      await supabase.from('pagos').insert({
        cuota_id: cuota.id,
        credito_id: entry.credito.id,
        cliente_id: entry.clienteId,
        fecha_pago: fechaPago,
        importe_cuota: cuotaBase,
        dias_atraso: 0,
        interes_mora: mora,
        total_cobrado: cobrado,
        cobrador: '',
        metodo_pago: 'efectivo'
      })

      pagosImportados++
      setProgreso({ actual: i + 1, total: pagoRows.length, msg: `Importando pagos... ${i + 1}/${pagoRows.length}` })
    }

    // ── PASO 3: Recalcular estado de cada crédito ──
    setProgreso({ actual: 0, total: Object.keys(creditoMap).length, msg: 'Actualizando estados...' })
    let idx = 0
    for (const entry of Object.values(creditoMap)) {
      const { data: todasCuotas } = await supabase
        .from('cuotas').select('*').eq('credito_id', entry.credito.id)
      const nuevoEstado = calcularEstadoCredito(todasCuotas || [], entry.credito.estado)
      await supabase.from('creditos').update({ estado: nuevoEstado }).eq('id', entry.credito.id)
      idx++
      setProgreso(p => ({ ...p, actual: idx }))
    }

    setErrores(errs)
    setResultado({ creditosImportados, pagosImportados, errores: errs.length })
    setImportando(false)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card">
        <h2 className="font-bold text-gray-800 text-lg mb-1">Importar Créditos Históricos</h2>
        <p className="text-sm text-gray-500 mb-5">
          Importá créditos activos con su historial de pagos. Usá esta herramienta una sola vez para migrar desde tu sistema anterior.
        </p>

        {/* CSV Créditos */}
        <div className="mb-4">
          <label className="label">CSV de Créditos</label>
          <p className="text-xs text-gray-400 mb-2">
            Columnas requeridas: <strong>DNI, CAPITAL, FINANCIADO, CUOTAS, CUOTA, TASA, MODALIDAD, INICIO, SITUACION</strong>
          </p>
          <input
            type="file" accept=".csv"
            onChange={e => { setArchivoCred(e.target.files[0]); setResultado(null) }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
          {archivoCred && <div className="text-xs text-green-600 mt-1">✓ {archivoCred.name}</div>}
        </div>

        {/* CSV Pagos */}
        <div className="mb-5">
          <label className="label">CSV de Pagos</label>
          <p className="text-xs text-gray-400 mb-2">
            Columnas requeridas: <strong>DNI, Fecha Inicio, N°, Fecha Cobro, Cobrado, Cuota</strong>
          </p>
          <input
            type="file" accept=".csv"
            onChange={e => { setArchivoPagos(e.target.files[0]); setResultado(null) }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
          {archivoPagos && <div className="text-xs text-green-600 mt-1">✓ {archivoPagos.name}</div>}
        </div>

        {archivoCred && archivoPagos && !resultado && (
          <button
            onClick={ejecutarImport}
            disabled={importando}
            className="btn-primary w-full"
          >
            {importando ? 'Importando...' : 'Iniciar importación'}
          </button>
        )}
      </div>

      {/* Progreso */}
      {importando && (
        <div className="card">
          <div className="text-sm font-medium text-gray-700 mb-2">{progreso.msg}</div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-orange-500 h-3 rounded-full transition-all duration-300"
              style={{ width: progreso.total ? `${Math.round((progreso.actual / progreso.total) * 100)}%` : '0%' }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">{progreso.actual} / {progreso.total}</div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Resultado</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <span className="text-2xl font-bold text-green-700">{resultado.creditosImportados}</span>
              <span className="text-sm text-green-700">créditos importados con sus cuotas</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <span className="text-2xl font-bold text-blue-700">{resultado.pagosImportados}</span>
              <span className="text-sm text-blue-700">pagos históricos registrados</span>
            </div>
            {resultado.errores > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                <span className="text-2xl font-bold text-red-700">{resultado.errores}</span>
                <span className="text-sm text-red-700">filas con error (ver detalle abajo)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Errores */}
      {errores.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-red-700 mb-3">Errores ({errores.length})</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {errores.map((err, i) => (
              <div key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
