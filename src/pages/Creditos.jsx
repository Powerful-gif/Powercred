import { Link } from 'react-router-dom'
import ListadoCreditos from '../components/Creditos/ListadoCreditos'

export default function Creditos() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-700">Gestión de Créditos</h2>
        <Link to="/creditos/nuevo" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Crédito
        </Link>
      </div>
      <ListadoCreditos />
    </div>
  )
}
