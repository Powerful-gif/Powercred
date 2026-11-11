import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider, useConfig } from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Verificar2FA from './pages/Verificar2FA'
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
import PrestamosPrivados from './pages/PrestamosPrivados'
import NuevoPrestamo from './components/PrestamosPrivados/NuevoPrestamo'
import DetallePrestamo from './components/PrestamosPrivados/DetallePrestamo'
import PrestamosLista from './pages/PrestamosLista'
import PrestamosCobros from './pages/PrestamosCobros'

// Ruta secreta de acceso del staff. No está linkeada desde ningún lado
// público: a diferencia de "/login", nadie que solo navegue el sitio la va
// a encontrar. Si alguna vez hay que cambiarla, es este único valor.
export const RUTA_LOGIN = '/acceso-powerful-2026'
const RUTA_PRESTAMOS = '/prestamos-privados'

function PrivateRoute({ children }) {
  const { user, loading, accesoPrivado } = useAuth()
  const { refrescarConfig } = useConfig()
  const { pathname } = useLocation()
  const [aalListo, setAalListo] = useState(false)
  const [requiereMfa, setRequiereMfa] = useState(false)
  const [configLista, setConfigLista] = useState(null)

  useEffect(() => {
    if (!user) { setAalListo(true); return }
    let activo = true
    setAalListo(false)
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!activo) return
      // Si hay error o el nivel actual todavía no es aal2, exigimos el
      // segundo paso (verificación en dos pasos obligatoria para todos).
      setRequiereMfa(!error && data ? data.currentLevel !== 'aal2' : true)
      setAalListo(true)
    })
    return () => { activo = false }
    // Se chequea solo cuando cambia la persona logueada (user.id), no en
    // cada renovación silenciosa del token (por ejemplo al volver a la
    // pestaña): eso generaba una recarga de golpe que borraba lo que se
    // estaba escribiendo en pantallas como Consulta o Nuevo Crédito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // La configuración se pide de nuevo al terminar el 2FA: antes de eso la base
  // no la entrega y quedarían las tasas por defecto del código en lugar de las
  // reales. Si no carga, no se deja operar con tasas equivocadas.
  useEffect(() => {
    if (!aalListo || !user || requiereMfa) return
    let activo = true
    setConfigLista(null)
    refrescarConfig().then(ok => { if (activo) setConfigLista(ok) })
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aalListo, requiereMfa, user?.id])

  if (loading || !aalListo || accesoPrivado === null) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Cargando...</div>
    </div>
  )
  // Si no hay sesión, nunca mandamos a la pantalla de login: cualquiera que
  // navegue el sitio sin estar logueado cae en la landing pública, como si
  // no existiera ningún sistema interno detrás.
  if (!user) return <Navigate to="/solicitar" replace />
  if (requiereMfa) return <Navigate to="/verificar-2fa" replace />

  if (configLista === null) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Cargando...</div>
    </div>
  )
  if (configLista === false) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center">
        <p className="text-gray-800 font-medium">No se pudo cargar la configuración del sistema.</p>
        <p className="text-sm text-gray-500 mt-2">Revisá la conexión a internet y probá de nuevo.</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-5">Reintentar</button>
      </div>
    </div>
  )

  const enPrestamosPrivados = pathname.startsWith(RUTA_PRESTAMOS)
  if (accesoPrivado && !enPrestamosPrivados) return <Navigate to={RUTA_PRESTAMOS} replace />
  if (!accesoPrivado && enPrestamosPrivados) return <Navigate to="/dashboard" replace />
  return children
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
      <Route path="/verificar-2fa" element={user ? <Verificar2FA /> : <Navigate to={RUTA_LOGIN} replace />} />
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
        <Route path="prestamos-privados" element={<PrestamosPrivados />} />
        <Route path="prestamos-privados/lista" element={<PrestamosLista />} />
        <Route path="prestamos-privados/cobros" element={<PrestamosCobros />} />
        <Route path="prestamos-privados/nuevo" element={<NuevoPrestamo />} />
        <Route path="prestamos-privados/:id" element={<DetallePrestamo />} />
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
