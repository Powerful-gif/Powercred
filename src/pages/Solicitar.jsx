import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOCALIDADES_CORDOBA } from '../lib/localidadesCordoba'

const TIENDA_URL = 'https://powerfulshop.com.ar'
const WHATSAPP_NUMERO = '5493571354939'

const PRODUCTOS = {
  credito: {
    nombre: 'POWERCRED',
    tagline: 'Tu hogar, nuestra misión',
    titulo: 'Crédito para comprar',
    descripcion: 'Financiá tu compra en el local, sin tarjeta y con cuotas fijas.',
    boton: 'Solicitar crédito',
    faq: [
      {
        q: '¿Qué necesito para pedir el crédito?',
        a: 'Ser mayor de 18 años y tu DNI. Con nombre, apellido, DNI y celular ya podés dejar tu solicitud.',
      },
      {
        q: '¿Necesito tarjeta de crédito?',
        a: 'No. PowerCred te permite comprar en el local sin usar ninguna tarjeta.',
      },
      {
        q: '¿En cuántas cuotas puedo pagar?',
        a: 'Podés elegir cuotas mensuales o semanales; el plan disponible depende del artículo y el monto.',
      },
      {
        q: '¿Qué pasa si me atraso con una cuota?',
        a: 'Se aplica un interés por mora sobre el importe de la cuota atrasada. Si sabés que vas a atrasarte, avisanos antes de la fecha de vencimiento.',
      },
      {
        q: '¿Cuánto tardan en contactarme?',
        a: 'Te contactamos al celular que nos dejes a la brevedad para confirmar tu solicitud.',
      },
    ],
  },
  efectivo: {
    nombre: 'POWERCASH',
    tagline: 'Préstamos en efectivo',
    titulo: 'Efectivo para lo que necesites',
    descripcion: 'Pedí tu préstamo en efectivo de forma simple y rápida.',
    boton: 'Solicitar efectivo',
    faq: [
      {
        q: '¿Para qué puedo usar el efectivo?',
        a: 'Para lo que necesites: no hay restricciones sobre el uso del dinero.',
      },
      {
        q: '¿Cómo recibo el dinero?',
        a: 'Una vez que evaluamos tu solicitud, te contactamos para coordinar cómo y dónde recibirlo.',
      },
      {
        q: '¿En cuántas cuotas lo devuelvo?',
        a: 'Podés elegir cuotas mensuales o semanales, según el monto del préstamo.',
      },
      {
        q: '¿Qué pasa si me atraso con una cuota?',
        a: 'Se aplica un interés por mora sobre el importe de la cuota atrasada. Si sabés que vas a atrasarte, avisanos antes de la fecha de vencimiento.',
      },
      {
        q: '¿Cuánto tardan en contactarme?',
        a: 'Te contactamos al celular que nos dejes a la brevedad para confirmar tu solicitud.',
      },
    ],
  },
}

function soloDigitos(v) {
  return v.replace(/\D/g, '')
}

function Acordeon({ items, esEfectivo }) {
  const [abierto, setAbierto] = useState(null)

  return (
    <div className={`rounded-2xl p-6 sm:p-8 mt-6 ${esEfectivo ? 'bg-emerald-950/40 border border-emerald-800' : 'bg-white border-2 border-orange-100'}`}>
      <h3 className={`text-lg font-extrabold mb-4 ${esEfectivo ? 'text-white' : 'text-gray-900'}`}>Preguntas frecuentes</h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const abiertoAhora = abierto === i
          return (
            <div key={i} className={`rounded-lg overflow-hidden ${esEfectivo ? 'border border-white/10' : 'border border-gray-100'}`}>
              <button
                type="button"
                onClick={() => setAbierto(abiertoAhora ? null : i)}
                className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 text-sm font-semibold transition-colors ${
                  esEfectivo ? 'text-white hover:bg-white/5' : 'text-gray-800 hover:bg-orange-50/60'
                }`}
              >
                {item.q}
                <span className={`shrink-0 transition-transform ${abiertoAhora ? 'rotate-45' : ''} ${esEfectivo ? 'text-white/70' : 'text-orange-500'}`}>+</span>
              </button>
              {abiertoAhora && (
                <div className={`px-4 pb-3 text-sm ${esEfectivo ? 'text-white/70' : 'text-gray-500'}`}>
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function sinTildes(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function BuscadorLocalidad({ value, onChange, inputClase, esEfectivo }) {
  const [busqueda, setBusqueda] = useState(value || '')
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef(null)

  useEffect(() => {
    function onClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  const texto = sinTildes(busqueda.trim())
  const coincidencias = (texto
    ? LOCALIDADES_CORDOBA.filter(loc => sinTildes(loc).includes(texto))
    : LOCALIDADES_CORDOBA
  ).slice(0, 40)

  function elegir(loc) {
    setBusqueda(loc)
    onChange(loc)
    setAbierto(false)
  }

  function handleInput(e) {
    setBusqueda(e.target.value)
    if (value) onChange('')
    setAbierto(true)
  }

  const listaClase = esEfectivo ? 'bg-emerald-950 border border-white/20' : 'bg-white border border-gray-200'
  const itemClase = esEfectivo ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-orange-50'
  const vacioClase = esEfectivo ? 'text-white/50' : 'text-gray-400'

  return (
    <div className="relative" ref={contenedorRef}>
      <input
        className={inputClase}
        value={busqueda}
        onChange={handleInput}
        onFocus={() => setAbierto(true)}
        placeholder="Escribí tu localidad"
        autoComplete="off"
      />
      {abierto && (
        <div className={`absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg shadow-lg ${listaClase}`}>
          {coincidencias.length > 0 ? (
            coincidencias.map(loc => (
              <button
                type="button"
                key={loc}
                onClick={() => elegir(loc)}
                className={`w-full text-left px-4 py-2 text-sm ${itemClase}`}
              >
                {loc}
              </button>
            ))
          ) : (
            <div className={`px-4 py-2 text-sm ${vacioClase}`}>No encontramos esa localidad</div>
          )}
        </div>
      )}
    </div>
  )
}

function FormularioSolicitud({ producto, onVolver }) {
  const info = PRODUCTOS[producto]
  const esEfectivo = producto === 'efectivo'
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [celular, setCelular] = useState('')
  const [localidad, setLocalidad] = useState('')
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
    if (!localidad) {
      setError('Elegí tu localidad de la lista que aparece al escribir.')
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
      provincia: 'Córdoba',
      localidad,
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

  const inputDisabledClase = esEfectivo
    ? 'w-full rounded-lg px-4 py-3 text-sm bg-white/5 border border-white/10 text-white/60'
    : 'w-full rounded-lg px-4 py-3 text-sm border-2 border-gray-100 bg-gray-50 text-gray-500'

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
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(`Hola! Soy ${nombre} ${apellido}, acabo de pedir ${info.nombre} por la web.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-full font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-colors inline-flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12.05 22c-1.55 0-3.06-.408-4.394-1.183L3 22l1.213-4.53A9.95 9.95 0 0 1 2 12.05C2 6.55 6.55 2 12.05 2 17.55 2 22 6.55 22 12.05S17.55 22 12.05 22z"/></svg>
            Escribinos por WhatsApp
          </a>
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
    <>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClase}>Provincia</label>
              <input className={inputDisabledClase} value="Córdoba" disabled readOnly />
            </div>
            <div>
              <label className={labelClase}>Localidad *</label>
              <BuscadorLocalidad value={localidad} onChange={setLocalidad} inputClase={inputClase} esEfectivo={esEfectivo} />
            </div>
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

      <Acordeon items={info.faq} esEfectivo={esEfectivo} />
    </>
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
