import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from './context/ConfigContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import FormCliente from './components/Clientes/FormCliente'
import FichaCliente from './components/Clientes/FichaCliente'
import Creditos from './pages/Creditos'
import NuevoCredito from './components/Creditos/NuevoCredito'
import DetalleCredito from './components/Creditos/DetalleCredito'
import Cobros from './pages/Cobros'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'

export default function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
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
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
