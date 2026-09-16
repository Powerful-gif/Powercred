import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Verificar2FA() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('cargando') // cargando | enroll | challenge
  const [factorId, setFactorId] = useState(null)
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setError('')
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setError('No se pudo consultar la verificación en dos pasos: ' + error.message)
      return
    }
    const verificado = data.totp.find(f => f.status === 'verified')
    if (verificado) {
      setFactorId(verificado.id)
      setStep('challenge')
      return
    }
    // Limpia intentos de configuración anteriores sin confirmar
    for (const f of data.totp.filter(f => f.status !== 'verified')) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError) {
      setError('No se pudo generar el código QR: ' + enrollError.message)
      return
    }
    setFactorId(enrollData.id)
    setQr(enrollData.totp.qr_code)
    setSecret(enrollData.totp.secret)
    setStep('enroll')
  }

  async function confirmar(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) {
      setLoading(false)
      setError('No se pudo iniciar la verificación, probá de nuevo')
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: codigo
    })
    setLoading(false)
    if (verifyError) {
      setError('Código incorrecto, probá de nuevo')
      setCodigo('')
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img
            src="/logo.png"
            alt="POWERCRED"
            className="h-28 object-contain rounded-2xl bg-white p-2"
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 'cargando' && (
            <div className="text-center text-gray-500 text-sm py-6">Cargando...</div>
          )}

          {step === 'enroll' && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Configurá la verificación en dos pasos</h1>
              <p className="text-sm text-gray-500 mb-4">
                Escaneá este código con Google Authenticator (o una app similar) desde tu celular.
              </p>
              <div className="flex justify-center mb-4 bg-gray-50 rounded-lg p-4">
                {qr && <img src={qr} alt="Código QR" className="w-44 h-44" />}
              </div>
              <p className="text-xs text-gray-500 mb-1">¿No podés escanear? Ingresá esta clave manualmente:</p>
              <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all mb-4">
                {secret}
              </div>
              <form onSubmit={confirmar} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código de 6 dígitos de la app
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-orange-400"
                    placeholder="000000"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || codigo.length !== 6}
                  className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verificando...' : 'Confirmar y activar'}
                </button>
              </form>
            </>
          )}

          {step === 'challenge' && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Verificación en dos pasos</h1>
              <p className="text-sm text-gray-500 mb-6">
                Ingresá el código de 6 dígitos de tu app autenticadora.
              </p>
              <form onSubmit={confirmar} className="space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-orange-400"
                    placeholder="000000"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || codigo.length !== 6}
                  className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>
            </>
          )}

          {error && step === 'cargando' && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2 mt-2">
              {error}
            </div>
          )}

          <button
            onClick={() => signOut()}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-6"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
