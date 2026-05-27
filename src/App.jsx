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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Cargando...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
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
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
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
        <Route path="reportes" element={<Reportes />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="autorizacion" element={<Autorizacion />} />
      </Route>
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
