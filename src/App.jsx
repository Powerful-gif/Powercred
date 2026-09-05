import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import FormCliente from './components/Clientes/FormCliente'
import FichaCliente from './components/Clientes/FichaCliente'
import Creditos from './pages/Creditos'
import NuevoCredito from './components/Creditos/NuevoCredito'
import DetalleCredito from './components/Creditos/DetalleCredito'
import Cobros from './pages/Cobros'
import Consulta from './pages/Consulta'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import Autorizacion from './pages/Autorizacion'
import Solicitar from './pages/Solicitar'
import SolicitudesWeb from './pages/SolicitudesWeb'

// Ruta secreta de acceso del staff. No está linkeada desde ningún lado
// público: a diferencia de "/login", nadie que solo navegue el sitio la va
// a encontrar. Si alguna vez hay que cambiarla, es este único valor.
export const RUTA_LOGIN = '/acceso-powerful-2026'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Cargando...</div>
    </div>
  )
  // Si no hay sesión, nunca mandamos a la pantalla de login: cualquiera que
  // navegue el sitio sin estar logueado cae en la landing pública, como si
  // no existiera ningún sistema interno detrás.
  return user ? children : <Navigate to="/solicitar" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Cargando...</div>
    </div>
  )
  return (
    <Routes>
      <Route path="/solicitar" element={<Solicitar />} />
      <Route path={RUTA_LOGIN} element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/nuevo" element={<FormCliente />} />
        <Route path="clientes/:id" element={<FichaCliente />} />
        <Route path="clientes/:id/editar" element={<FormCliente />} />
        <Route path="creditos" element={<Creditos />} />
        <Route path="creditos/nuevo" element={<NuevoCredito />} />
        <Route path="creditos/:id" element={<DetalleCredito />} />
        <Route path="cobros" element={<Cobros />} />
        <Route path="consulta" element={<Consulta />} />
        <Route path="solicitudes-web" element={<SolicitudesWeb />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="autorizacion" element={<Autorizacion />} />
      </Route>
      {/* Cualquier otra ruta (typos, gente curiosa probando /admin, /panel, etc.)
          cae en la landing pública, nunca en un error ni en una pista del sistema interno. */}
      <Route path="*" element={<Navigate to="/solicitar" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </AuthProvider>
  )
}
