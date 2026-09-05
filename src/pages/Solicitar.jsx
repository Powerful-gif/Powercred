import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TIENDA_URL = 'https://powerfulshop.com.ar'

const PRODUCTOS = {
  credito: {
    nombre: 'POWERCRED',
    tagline: 'Tu hogar, nuestra misión',
    titulo: 'Crédito para comprar',
    descripcion: 'Financiá tu compra en el local, sin tarjeta y con cuotas fijas.',
    boton: 'Solicitar crédito',
  },
  efectivo: {
    nombre: 'POWERCASH',
    tagline: 'Préstamos en efectivo',
    titulo: 'Efectivo para lo que necesites',
    descripcion: 'Pedí tu préstamo en efectivo de forma simple y rápida.',
    boton: 'Solicitar efectivo',
  },
}

function soloDigitos(v) {
  return v.replace(/\D/g, '')
}

function FormularioSolicitud({ producto, onVolver }) {
  const info = PRODUCTOS[producto]
  const esEfectivo = producto === 'efectivo'
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [celular, setCelular] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!nombre.trim() || !apellido.trim()) {
      setError('Completá tu nombre y apellido.')
      return
    }
    const dniLimpio = soloDigitos(dni)
    if (dniLimpio.length < 7 || dniLimpio.length > 8) {
      setError('Ingresá un DNI válido (7 u 8 números, sin puntos).')
      return
    }
    const celularLimpio = soloDigitos(celular)
    if (celularLimpio.length < 8) {
      setError('Ingresá un celular válido, con código de área.')
      return
    }
    if (!acepto) {
      setError('Para continuar tenés que aceptar el uso de tus datos.')
      return
    }

    setEnviando(true)
    const { error: dbError } = await supabase.from('solicitudes_web').insert({
      producto,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      dni: dniLimpio,
      celular: celularLimpio,
    })
    setEnviando(false)

    if (dbError) {
      setError('No pudimos enviar tu solicitud. Probá de nuevo en unos minutos.')
      return
    }
    setEnviado(true)
  }

  const panelClase = esEfectivo
    ? 'bg-gradient-to-br from-emerald-800 to-emerald-950 text-white'
    : 'bg-white border-2 border-orange-100'

  const inputClase = esEfectivo
    ? 'w-full rounded-lg px-4 py-3 text-sm bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/60'
    : 'w-full rounded-lg px-4 py-3 text-sm border-2 border-gray-200 focus:outline-none focus:border-orange-400'

  const labelClase = esEfectivo ? 'block text-sm font-medium text-white/80 mb-1' : 'block text-sm font-medium text-gray-700 mb-1'

  if (enviado) {
    return (
      <div className={`rounded-2xl p-8 sm:p-10 text-center ${panelClase}`}>
        <div className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${esEfectivo ? 'bg-white/10' : 'bg-orange-100'}`}>
          <svg className={`w-7 h-7 ${esEfectivo ? 'text-white' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">¡Listo, {nombre}!</h2>
        <p className={esEfectivo ? 'text-white/80' : 'text-gray-500'}>
          Recibimos tu solicitud de {info.nombre.toLowerCase()}. Te vamos a contactar al {celular} a la brevedad.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button onClick={onVolver} className="px-6 py-2.5 rounded-full font-bold text-sm bg-orange-600 text-white hover:bg-orange-700 transition-colors">
            Volver al inicio
          </button>
          <a href={TIENDA_URL} className={`px-6 py-2.5 rounded-full font-bold text-sm transition-colors ${esEfectivo ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            Ir a la tienda
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl p-6 sm:p-10 ${panelClase}`}>
      <button
        onClick={onVolver}
        className={`text-sm mb-6 inline-flex items-center gap-1 ${esEfectivo ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
      >
        ← Elegir otra opción
      </button>

      <h2 className={`text-2xl font-extrabold mb-1 ${esEfectivo ? 'text-white' : 'text-gray-900'}`}>{info.nombre}</h2>
      <p className={`text-sm mb-6 ${esEfectivo ? 'text-white/70' : 'text-gray-500'}`}>{info.descripcion}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClase}>Nombre *</label>
            <input className={inputClase} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan" autoFocus />
          </div>
          <div>
            <label className={labelClase}>Apellido *</label>
            <input className={inputClase} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej: García" />
          </div>
        </div>

        <div>
          <label className={labelClase}>DNI *</label>
          <input className={inputClase} value={dni} onChange={e => setDni(e.target.value)} placeholder="Ej: 30123456" inputMode="numeric" maxLength={9} />
        </div>

        <div>
          <label className={labelClase}>Celular *</label>
          <input className={inputClase} value={celular} onChange={e => setCelular(e.target.value)} placeholder="Ej: 0351 1234567" inputMode="tel" />
        </div>

        <label className={`flex items-start gap-2 text-xs pt-1 ${esEfectivo ? 'text-white/70' : 'text-gray-500'}`}>
          <input type="checkbox" className="mt-0.5" checked={acepto} onChange={e => setAcepto(e.target.checked)} />
          Acepto que Powerful use estos datos para evaluar y gestionar mi solicitud.
        </label>

        {error && (
          <div className={`text-sm rounded-lg px-4 py-3 ${esEfectivo ? 'bg-red-500/20 text-red-100 border border-red-400/30' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-full font-bold text-sm transition-colors disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : info.boton}
        </button>
      </form>
    </div>
  )
}

function IconoRayo() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function IconoMonedas() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14m0-6c1.11 0 2.08.402 2.599 1M12 8V7m0 1v6m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export default function Solicitar() {
  const [params] = useSearchParams()
  const inicial = ['credito', 'efectivo'].includes(params.get('producto')) ? params.get('producto') : null
  const [producto, setProducto] = useState(inicial)

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Powerful" className="h-16 object-contain rounded-xl bg-white p-2 shadow-sm" onError={e => { e.target.style.display = 'none' }} />
        </div>

        {producto ? (
          <div className="max-w-lg mx-auto">
            <FormularioSolicitud producto={producto} onVolver={() => setProducto(null)} />
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">Elegí cómo financiarte</h1>
              <p className="text-gray-500 max-w-md mx-auto">
                Accedé a un crédito para comprar en Powerful o a un préstamo en efectivo. Te contactamos en el día.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PowerCred */}
              <div className="bg-white border-2 border-orange-100 rounded-2xl shadow-sm p-8 flex flex-col">
                <span className="text-[11px] font-bold tracking-widest text-orange-600 uppercase mb-1">Tu hogar, nuestra misión</span>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-3">POWERCRED</h2>
                <p className="text-gray-500 text-sm mb-6 flex-1">
                  Solicitá tu crédito y comprá sin tarjeta. Completá tus datos y accedé a un crédito personal para tu hogar.
                </p>
                <button
                  onClick={() => setProducto('credito')}
                  className="self-start bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-full font-bold text-sm transition-colors inline-flex items-center gap-2"
                >
                  Ver más
                  <span aria-hidden>→</span>
                </button>
              </div>

              {/* PowerCash */}
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-2xl shadow-sm p-8 flex flex-col">
                <span className="text-[11px] font-bold tracking-widest text-emerald-300 uppercase mb-1">Préstamos en efectivo</span>
                <h2 className="text-2xl font-extrabold mb-3">POWERCASH</h2>
                <p className="text-white/70 text-sm mb-4 flex-1">
                  Efectivo para lo que necesites. Completá tus datos y accedé a un préstamo personal de forma simple y rápida.
                </p>
                <div className="flex gap-4 mb-6 text-xs text-white/80">
                  <div className="flex items-center gap-1.5">
                    <IconoRayo /> Respuesta rápida
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconoMonedas /> Para lo que necesites
                  </div>
                </div>
                <button
                  onClick={() => setProducto('efectivo')}
                  className="self-start bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-full font-bold text-sm transition-colors inline-flex items-center gap-2"
                >
                  Ver más
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </>
        )}

        <p className="text-center text-gray-400 text-xs mt-10">Powerful · Pedro C. Molina N° 318, Almafuerte, Córdoba</p>
      </div>
    </div>
  )
}
