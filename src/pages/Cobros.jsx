import { useState } from 'react'
import PantallaCobranza from '../components/Cobros/PantallaCobranza'
import CobroParticulares from '../components/Cobros/CobroParticulares'

const SOLAPAS = [
  { id: 'creditos', nombre: 'Créditos' },
  { id: 'particulares', nombre: 'Préstamos particulares' },
]

export default function Cobros() {
  const [solapa, setSolapa] = useState('creditos')

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Módulo de Cobros</h2>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6">
        {SOLAPAS.map(s => (
          <button
            key={s.id}
            onClick={() => setSolapa(s.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              solapa === s.id ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>
      {solapa === 'creditos' ? <PantallaCobranza /> : <CobroParticulares />}
    </div>
  )
}
