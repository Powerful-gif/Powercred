import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { supabase } from '../lib/supabase'
import { hoyArgentina } from '../lib/formatters'

export default function Configuracion() {
  const { config, saveConfig } = useConfig()
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tab, setTab] = useState('negocio')

  // Estado local para edición
  const [negocio, setNegocio] = useState(config.negocio)
  const [pagare, setPagare] = useState(config.pagare)
  const [mora, setMora] = useState(config.mora)
  const [tasas, setTasas] = useState(config.tasas)

  async function guardar() {
    setGuardando(true)
    await saveConfig({ negocio, pagare, mora, tasas })
    setMensaje('Configuración guardada correctamente')
    setGuardando(false)
    setTimeout(() => setMensaje(''), 3000)
  }

  async function exportarBackup() {
    const { data: clientes } = await supabase.from('clientes').select('*')
    const { data: creditos } = await supabase.from('creditos').select('*')
    const { data: cuotas } = await supabase.from('cuotas').select('*')
    const { data: pagos } = await supabase.from('pagos').select('*')

    const backup = {
      version: '1.0',
      fecha: hoyArgentina(),
      clientes: clientes || [],
      creditos: creditos || [],
      cuotas: cuotas || [],
      pagos: pagos || []
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `powercred-backup-${hoyArgentina()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function actualizarTasa(tipo, periodicidad, cuotas, valor) {
    setTasas(prev => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [periodicidad]: {
          ...prev[tipo][periodicidad],
          [cuotas]: Number(valor)
        }
      }
    }))
  }

  const tabs = [
    { key: 'negocio', label: 'Datos del negocio' },
    { key: 'pagare', label: 'Pagaré' },
    { key: 'tasas', label: 'Tasas de interés' },
    { key: 'mora', label: 'Interés mora' },
    { key: 'backup', label: 'Backup' },
  ]

  return (
    <div className="max-w-3xl space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Datos del negocio */}
      {tab === 'negocio' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Datos del Negocio</h3>
          {[
            { key: 'nombre', label: 'Nombre del negocio' },
            { key: 'subtitulo', label: 'Subtítulo (ej: PRÉSTAMOS)' },
            { key: 'direccion', label: 'Dirección' },
            { key: 'localidad', label: 'Localidad' },
            { key: 'provincia', label: 'Provincia' },
            { key: 'telefono', label: 'Teléfono' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input type="text" className="input-field"
                value={negocio[f.key] || ''}
                onChange={e => setNegocio(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* Pagaré */}
      {tab === 'pagare' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Datos del Pagaré</h3>
          {[
            { key: 'localidad', label: 'Localidad de emisión' },
            { key: 'acreedor', label: 'Nombre del acreedor' },
            { key: 'cuit', label: 'CUIT del acreedor' },
            { key: 'direccion', label: 'Dirección de pago' },
            { key: 'ciudad', label: 'Ciudad de pago' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input type="text" className="input-field"
                value={pagare[f.key] || ''}
                onChange={e => setPagare(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}

      {/* Tasas */}
      {tab === 'tasas' && (
        <div className="space-y-4">
          {[
            { key: 'hogar', label: '🏠 Crédito del Hogar' },
            { key: 'efectivo', label: '💵 Préstamo en Efectivo' },
            { key: 'colchones', label: '🛋️ Colchones y Sillones' },
          ].map(({ key: tipo, label }) => (
            <div key={tipo} className="card">
              <h3 className="font-semibold text-gray-900 mb-4">{label}</h3>
              {[
                { key: 'mensual', label: 'Mensuales' },
                { key: 'quincenal', label: 'Quincenales' },
                { key: 'semanal', label: 'Semanales' },
              ].map(({ key: period, label: periodLabel }) => (
                <div key={period} className="mb-5">
                  <div className="text-sm font-medium text-gray-600 mb-2">{periodLabel}</div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(tasas[tipo]?.[period] || {}).map(([cuotas, tasa]) => (
                      <div key={cuotas} className="flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-500">{cuotas} cuotas</div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="input-field w-20 text-center text-sm"
                            value={tasa}
                            onChange={e => actualizarTasa(tipo, period, cuotas, e.target.value)}
                            step="0.5" min="0"
                          />
                          <span className="text-gray-400 text-sm">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        </div>
      )}

      {/* Mora */}
      {tab === 'mora' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Interés por mora</h3>
          <div>
            <label className="label">Tasa diaria de mora (%)</label>
            <div className="flex items-center gap-2">
              <input type="number"
                className="input-field w-32"
                value={mora.tasa_diaria}
                onChange={e => setMora({ tasa_diaria: parseFloat(e.target.value) })}
                step="0.05" min="0" />
              <span className="text-gray-500 text-sm">% por día</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Mora = días de atraso × {mora.tasa_diaria}% × importe de la cuota
            </p>
          </div>
        </div>
      )}

      {/* Backup */}
      {tab === 'backup' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900">Backup de datos</h3>
          <p className="text-sm text-gray-500">
            Exporta todos los datos (clientes, créditos, cuotas, pagos) a un archivo JSON.
            Guardá este archivo en un lugar seguro como respaldo.
          </p>
          <button onClick={exportarBackup} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Descargar backup JSON
          </button>
          <p className="text-xs text-gray-400">
            Recomendado: hacer backup al menos una vez por semana.
            El archivo se descargará con la fecha actual en el nombre.
          </p>
        </div>
      )}

      {/* Guardar */}
      {tab !== 'backup' && (
        <div className="flex items-center gap-4">
          <button onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {mensaje && (
            <span className="text-green-600 text-sm font-medium">{mensaje}</span>
          )}
        </div>
      )}
    </div>
  )
}
