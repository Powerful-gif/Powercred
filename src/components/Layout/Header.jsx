import { useLocation, Link } from 'react-router-dom'
import { formatFecha, hoyArgentina } from '../../lib/formatters'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/clientes/nuevo': 'Nuevo Cliente',
  '/creditos': 'Créditos',
  '/creditos/nuevo': 'Nuevo Crédito',
  '/cobros': 'Cobros',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
}

export default function Header() {
  const { pathname } = useLocation()

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || (key !== '/' && pathname.startsWith(key + '/'))
  )?.[1] ?? 'POWERCRED'

  const hoy = formatFecha(hoyArgentina())

  return (
    <header className="header-nav bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 no-print">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{hoy}</span>
        <Link to="/creditos/nuevo"
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Crédito
        </Link>
      </div>
    </header>
  )
}
