import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoneda } from '../lib/formatters'

function calcularVerificador(base) {
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let suma = 0
  for (let i = 0; i < 10; i++) suma += parseInt(base[i]) * mult[i]
  const resto = suma % 11
  if (resto === 0) return 0
  if (resto === 1) return -1
  return 11 - resto
}

function dniACuit(dni, sexo) {
  const dniStr = String(dni).padStart(8, '0')
  const prefixes = sexo === 'F' ? ['27', '23'] : ['20', '23']
  for (const prefix of prefixes) {
    const base = prefix + dniStr
    const v = calcularVerificador(base)
    if (v >= 0) return base + v
  }
  return null
}

const SITUACION = {
  1: { label: 'Normal', color: 'green' },
  2: { label: 'Con seguimiento', color: 'yellow' },
  3: { label: 'Con problemas', color: 'red' },
  4: { label: 'Alto riesgo', color: 'red' },
  5: { label: 'Irrecuperable', color: 'red' },
  6: { label: 'Incobrable', color: 'red' },
}

function calcularRecomendacion(bcraData, chequesData, ingresos, empleo) {
  let peorSituacion = 0
  const periodos = bcraData?.results?.periodos || []
  for (const p of periodos.slice(0, 3)) {
    for (const e of (p.entidades || [])) {
      if (e.situacion > peorSituacion) peorSituacion = e.situacion
    }
  }

  const chequesCount = chequesData?.results?.causales?.length || 0

  let estado = 'aprobado'
  let motivos = []

  if (peorSituacion >= 3) {
    estado = 'rechazado'
    motivos.push(`Situación ${peorSituacion} en el sistema financiero`)
  }
  if (chequesCount > 0) {
    if (estado !== 'rechazado') estado = 'precaucion'
    motivos.push(`${chequesCount} cheque(s) rechazado(s)`)
  }
  if (peorSituacion === 2 && estado === 'aprobado') {
    estado = 'precaucion'
    motivos.push('Atrasos leves en el sistema financiero')
  }
  if (empleo === 'desempleado' && estado === 'aprobado') {
    estado = 'precaucion'
    motivos.push('Sin empleo fijo declarado')
  }

  const factores = { empleado: 0.35, jubilado: 0.30, independiente: 0.25, desempleado: 0.15 }
  const factor = factores[empleo] || 0.25
  let montoSugerido = Math.floor((ingresos * factor) / 1000) * 1000
  if (estado === 'precaucion') montoSugerido = Math.floor(montoSugerido * 0.6 / 1000) * 1000
  if (estado === 'rechazado') montoSugerido = 0

  return { estado, motivos, montoSugerido, peorSituacion, chequesCount }
}

export default function Autorizacion() {
  const [dni, setDni] = useState('')
  const [sexo, setSexo] = useState('M')
  const [ingresos, setIngresos] = useState('')
  const [empleo, setEmpleo] = useState('empleado')
  const [consultando, setConsultando] = useState(false)
  const [error, setError] = useState('')
  const [bcraData, setBcraData] = useState(null)
  const [chequesData, setChequesData] = useState(null)
  const [clienteExistente, setClienteExistente] = useState(null)
  const [consultado, setConsultado] = useState(false)
  const [cuitUsado, setCuitUsado] = useState('')

  async function consultar() {
    if (!dni || String(dni).length < 7) { setError('Ingresá un DNI válido'); return }
    setError('')
    setConsultando(true)
    setBcraData(null)
    setChequesData(null)
    setConsultado(false)

    const cuit = dniACuit(dni, sexo)
    if (!cuit) { setError('No se pudo calcular el CUIT'); setConsultando(false); return }
    setCuitUsado(cuit)

    try {
      const { data: cliente } = await supabase.from('clientes').select('*').eq('dni', dni).single()
      setClienteExistente(cliente || null)

      const [deudaRes, chequesRes] = await Promise.all([
        fetch(`/api/bcra-deudas?cuit=${cuit}`),
        fetch(`/api/bcra-cheques?cuit=${cuit}`)
      ])

      const deuda = await deudaRes.json()
      const cheques = await chequesRes.json()

      setBcraData(deuda.status === 200 ? deuda : { results: { denominacion: '', periodos: [] } })
      setChequesData(cheques.status === 200 ? cheques : { results: { causales: [] } })
    } catch (e) {
      setError('Error consultando el BCRA. Verificá tu conexión.')
    }

    setConsultando(false)
    setConsultado(true)
  }

  const periodos = bcraData?.results?.periodos?.slice(0, 6) || []
  const denominacion = bcraData?.results?.denominacion || ''
  const rec = consultado && ingresos
    ? calcularRecomendacion(bcraData, chequesData, parseFloat(ingresos), empleo)
    : null

  return (
    <div className="max-w-3xl space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">Autorización de Crédito</h2>

      {/* Búsqueda */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">Consulta BCRA</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">DNI</label>
            <input
              type="number"
              className="input-field"
              placeholder="12345678"
              value={dni}
              onChange={e => setDni(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && consultar()}
            />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input-field" value={sexo} onChange={e => setSexo(e.target.value)}>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <button onClick={consultar} disabled={consultando} className="btn-primary">
          {consultando ? 'Consultando...' : 'Consultar BCRA'}
        </button>
      </div>

      {/* Resultados BCRA */}
      {consultado && (
        <>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {denominacion || 'Sin antecedentes en BCRA'}
              </h3>
              <span className="text-xs text-gray-400">CUIT: {cuitUsado}</span>
            </div>

            {clienteExistente && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                Cliente registrado: <strong>{clienteExistente.apellido}, {clienteExistente.nombre}</strong> · {clienteExistente.codigo}
              </div>
            )}

            {/* Situación por período */}
            {periodos.length > 0 ? (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Situación en el sistema financiero</div>
                <div className="space-y-1">
                  {periodos.map(p => {
                    const peor = Math.max(...(p.entidades || []).map(e => e.situacion))
                    const total = (p.entidades || []).reduce((s, e) => s + (e.monto || 0), 0)
                    const info = SITUACION[peor]
                    return (
                      <div key={p.periodo} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-600">{p.periodo}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{formatMoneda(total * 1000)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            info?.color === 'green' ? 'bg-green-100 text-green-700' :
                            info?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            Sit. {peor} · {info?.label || 'Desconocida'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Sin deudas registradas en el sistema financiero
              </div>
            )}

            {/* Cheques */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Cheques rechazados</div>
              {(chequesData?.results?.causales?.length || 0) > 0 ? (
                <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  {chequesData.results.causales.length} cheque(s) rechazado(s)
                </div>
              ) : (
                <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  Sin cheques rechazados
                </div>
              )}
            </div>
          </div>

          {/* Datos manuales */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">Datos del solicitante</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Situación laboral</label>
                <select className="input-field" value={empleo} onChange={e => setEmpleo(e.target.value)}>
                  <option value="empleado">Empleado en relación de dependencia</option>
                  <option value="independiente">Independiente / Monotributista</option>
                  <option value="jubilado">Jubilado / Pensionado</option>
                  <option value="desempleado">Sin trabajo fijo</option>
                </select>
              </div>
              <div>
                <label className="label">Ingresos mensuales</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    className="input-field pl-7"
                    placeholder="0"
                    value={ingresos}
                    onChange={e => setIngresos(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {!ingresos && (
              <p className="text-xs text-gray-400">Ingresá los ingresos para ver la recomendación de monto.</p>
            )}
          </div>

          {/* Recomendación */}
          {rec && (
            <div className={`card border-2 ${
              rec.estado === 'aprobado' ? 'border-green-400 bg-green-50' :
              rec.estado === 'precaucion' ? 'border-yellow-400 bg-yellow-50' :
              'border-red-400 bg-red-50'
            }`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${
                  rec.estado === 'aprobado' ? 'bg-green-500' :
                  rec.estado === 'precaucion' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}>
                  {rec.estado === 'aprobado' ? '✓' : rec.estado === 'precaucion' ? '!' : '✗'}
                </div>
                <div>
                  <div className={`text-xl font-bold ${
                    rec.estado === 'aprobado' ? 'text-green-800' :
                    rec.estado === 'precaucion' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    {rec.estado === 'aprobado' ? 'APROBADO' :
                     rec.estado === 'precaucion' ? 'PRECAUCIÓN' : 'RECHAZADO'}
                  </div>
                  {rec.motivos.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {rec.motivos.map((m, i) => (
                        <li key={i} className="text-sm text-gray-700">· {m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {rec.montoSugerido > 0 && (
                <div className="border-t border-gray-200 pt-3 mt-1">
                  <div className="text-sm text-gray-600">Cuota mensual máxima sugerida</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">{formatMoneda(rec.montoSugerido)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {empleo === 'empleado' ? '35%' : empleo === 'jubilado' ? '30%' : empleo === 'independiente' ? '25%' : '15%'} de ingresos declarados
                    {rec.estado === 'precaucion' ? ' · reducido por precaución' : ''}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
