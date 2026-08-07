import { useState, useEffect } from 'react'
import { useConfig } from '../context/ConfigContext'
import { calcularCuota } from '../lib/calculos'
import { formatMoneda } from '../lib/formatters'

async function buscarPorEan(ean) {
  const r = await fetch(`/api/precio-por-ean?ean=${encodeURIComponent(ean)}`)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Error desconocido')
  return data
}

async function buscarRubrosDisponibles() {
  const r = await fetch('/api/buscar-catalogo?accion=rubros')
  if (!r.ok) return []
  return r.json()
}

async function buscarPorCatalogo({ rubro, subRubro, nombre }) {
  const params = new URLSearchParams()
  if (rubro) params.set('rubro', rubro)
  if (subRubro) params.set('sub_rubro', subRubro)
  if (nombre) params.set('nombre', nombre)
  const r = await fetch(`/api/buscar-catalogo?${params.toString()}`)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Error desconocido')
  return data
}

const PLANES = {
  mensual:   { label: 'Mensual',   opciones: [3, 6, 9, 12] },
  quincenal: { label: 'Quincenal', opciones: [4, 6, 8, 10, 12] },
  semanal:   { label: 'Semanal',   opciones: [4, 8, 12, 16, 20, 24] },
}

export default function Consulta() {
  const { config, getTasaGrupo, esCuotaTarjetaNaranja, detectarGrupoPorRubroDux, detectarGrupoTarjetaPorRubroDux } = useConfig()
  const [precio, setPrecio] = useState('')
  const [modoEntrega, setModoEntrega] = useState('0')
  const [pctCustom, setPctCustom] = useState('')
  const [rubro, setRubro] = useState('general')
  const [rubroTarjeta, setRubroTarjeta] = useState('general')
  const [abiertos, setAbiertos] = useState({ powercred: false, mensual: true, quincenal: false, semanal: false, tarjeta: false })
  const [ean, setEan] = useState('')
  const [producto, setProducto] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  const [opcionesRubros, setOpcionesRubros] = useState([])
  const [rubroCatSel, setRubroCatSel] = useState('')
  const [subRubroCatSel, setSubRubroCatSel] = useState('')
  const [nombreCatFiltro, setNombreCatFiltro] = useState('')
  const [resultadosCatalogo, setResultadosCatalogo] = useState(null)
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false)
  const [errorCatalogo, setErrorCatalogo] = useState('')

  const grupoActual = config.gruposTasa.find(g => g.id === rubro) || config.gruposTasa[0]
  const grupoTarjetaActual = config.gruposTarjeta.find(g => g.id === rubroTarjeta) || config.gruposTarjeta[0]

  useEffect(() => {
    buscarRubrosDisponibles().then(setOpcionesRubros)
  }, [])

  const rubrosUnicos = [...new Set(opcionesRubros.map(r => r.rubro))].filter(Boolean).sort()
  const subRubrosDisponibles = [...new Set(
    opcionesRubros.filter(r => r.rubro === rubroCatSel).map(r => r.sub_rubro)
  )].filter(Boolean).sort()

  async function elegirProducto(p) {
    setPrecio(String(p.precio)) // precio de la lista, se confirma/actualiza abajo con la búsqueda completa
    setEan('')
    setErrorBusqueda('')
    setBuscando(true)
    setProducto(null)
    document.getElementById('calculadora')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try {
      const data = await buscarPorEan(p.sku)
      setProducto(data)
      setPrecio(String(data.precio_pvp))
      setRubro(detectarGrupoPorRubroDux(data.rubro))
      setRubroTarjeta(detectarGrupoTarjetaPorRubroDux(data.rubro))
    } catch (e) {
      // si falla traer la ficha completa, dejamos al menos los datos básicos que ya teníamos
      setProducto({
        sku: p.sku, nombre: p.nombre, marca: p.marca, rubro: p.rubro,
        sub_rubro: p.sub_rubro, stock: p.stock, descripcion_html: '', fuente_descripcion: null,
      })
      setRubro(detectarGrupoPorRubroDux(p.rubro))
      setRubroTarjeta(detectarGrupoTarjetaPorRubroDux(p.rubro))
    } finally {
      setBuscando(false)
    }
  }

  async function handleBuscarCatalogo() {
    setBuscandoCatalogo(true)
    setErrorCatalogo('')
    setResultadosCatalogo(null)
    try {
      const data = await buscarPorCatalogo({ rubro: rubroCatSel, subRubro: subRubroCatSel, nombre: nombreCatFiltro })
      setResultadosCatalogo(data)
    } catch (e) {
      setErrorCatalogo(e.message)
    } finally {
      setBuscandoCatalogo(false)
    }
  }

  async function handleBuscarEan() {
    const valor = ean.trim()
    if (!valor) return
    setBuscando(true)
    setErrorBusqueda('')
    setProducto(null)
    try {
      const data = await buscarPorEan(valor)
      setProducto(data)
      setPrecio(String(data.precio_pvp))
      setRubro(detectarGrupoPorRubroDux(data.rubro))
      setRubroTarjeta(detectarGrupoTarjetaPorRubroDux(data.rubro))
    } catch (e) {
      setErrorBusqueda(e.message)
    } finally {
      setBuscando(false)
      setEan('')
    }
  }

  const pct = modoEntrega === 'custom' ? null : parseFloat(modoEntrega)
  const precioNum = parseFloat(precio) || 0
  const precioEfectivo = precioNum * 0.9
  const entrega = modoEntrega === 'custom'
    ? (parseFloat(pctCustom) || 0)
    : Math.round(precioNum * pct / 100)
  const aFinanciar = Math.max(0, precioNum - entrega)
  const hayImporte = aFinanciar > 0

  function toggle(peri) {
    setAbiertos(prev => ({ ...prev, [peri]: !prev[peri] }))
  }

  function getTasaRubro(n, peri) {
    return getTasaGrupo(rubro, peri, n)
  }

  function filas(peri, opciones) {
    return opciones.map(n => {
      const tasa = getTasaRubro(n, peri)
      const { cuota } = calcularCuota(aFinanciar, tasa, n)
      return { n, tasa, cuota }
    })
  }

  const rubroLabel = grupoActual?.nombre || 'General'

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── CONTENIDO PARA IMPRIMIR ── */}
      {hayImporte && (
        <div className="print-only">
          <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '600px' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{config.negocio?.nombre || 'POWERFUL'}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>{config.negocio?.direccion} · {config.negocio?.localidad}</div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>
              Opciones de Financiación · {rubroLabel}
            </div>
            <div style={{ display: 'flex', gap: '20px', background: '#f5f5f5', padding: '10px 14px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' }}>
              <span><strong>Precio:</strong> {formatMoneda(precioNum)}</span>
              <span><strong>Efectivo (10% off):</strong> {formatMoneda(precioEfectivo)}</span>
              {entrega > 0 && <span><strong>Entrega{pct ? ` (${pct}%)` : ''}:</strong> {formatMoneda(entrega)}</span>}
              <span><strong>Financia:</strong> {formatMoneda(aFinanciar)}</span>
            </div>
            {Object.entries(PLANES)
              .filter(([peri]) => abiertos[peri])
              .map(([peri, { label, opciones }]) => (
                <div key={peri} style={{ marginBottom: '18px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>{label}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #ddd' }}>Cuotas</th>
                        <th style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #ddd' }}>Valor cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas(peri, opciones).map(({ n, cuota }) => (
                        <tr key={n}>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{n} cuotas</td>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                            {formatMoneda(cuota)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            {abiertos.tarjeta && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>Tarjeta de Crédito</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#eee' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #ddd' }}>Cuotas</th>
                      <th style={{ padding: '7px 10px', textAlign: 'center', border: '1px solid #ddd' }}>Valor cuota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(grupoTarjetaActual.tarjeta).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, tasa]) => {
                      const { cuota } = calcularCuota(aFinanciar, tasa, Number(n))
                      return (
                        <tr key={n}>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            {n} cuotas{esCuotaTarjetaNaranja(n) ? ' (Solo Naranja)' : ''}
                          </td>
                          <td style={{ padding: '7px 10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                            {formatMoneda(cuota)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PANTALLA ── */}

      {/* Buscar por rubro/sub-rubro */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">Buscar por categoría</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            className="input-field"
            value={rubroCatSel}
            onChange={e => { setRubroCatSel(e.target.value); setSubRubroCatSel('') }}
          >
            <option value="">Todos los rubros</option>
            {rubrosUnicos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            className="input-field"
            value={subRubroCatSel}
            onChange={e => setSubRubroCatSel(e.target.value)}
            disabled={!rubroCatSel}
          >
            <option value="">Todos los sub-rubros</option>
            {subRubrosDisponibles.map(sr => <option key={sr} value={sr}>{sr}</option>)}
          </select>

          <input
            type="text"
            className="input-field"
            placeholder="Nombre (ej: escritorio)"
            value={nombreCatFiltro}
            onChange={e => setNombreCatFiltro(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBuscarCatalogo() }}
          />
        </div>

        <button
          onClick={handleBuscarCatalogo}
          disabled={buscandoCatalogo}
          className="w-full sm:w-auto px-6 py-2 rounded-lg bg-gray-800 text-white font-medium disabled:opacity-50"
        >
          {buscandoCatalogo ? 'Buscando...' : 'Buscar'}
        </button>

        {errorCatalogo && <div className="text-sm text-red-600">{errorCatalogo}</div>}

        {resultadosCatalogo && (
          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs text-gray-400 mb-2">
              {resultadosCatalogo.length} producto{resultadosCatalogo.length !== 1 ? 's' : ''} en stock
              {' '}(precios de la última sincronización nocturna)
            </div>
            {resultadosCatalogo.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No se encontraron productos con stock.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Marca</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Producto</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">SKU</th>
                      <th className="text-center py-2 px-3 text-gray-500 font-medium">Stock</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Precio</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosCatalogo.map(p => (
                      <tr key={p.sku} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600">{p.marca || '—'}</td>
                        <td className="py-2 px-3 font-medium text-gray-800">{p.nombre}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{p.sku}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{p.stock}</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-900">{formatMoneda(p.precio)}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => elegirProducto(p)}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Elegir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entrada */}
      <div id="calculadora" className="card space-y-5">
        <h2 className="font-bold text-gray-800 text-lg">Calculadora de Financiación</h2>

        <div>
          <label className="label">Código de barras o SKU</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field text-lg flex-1"
              placeholder="Escaneá el código de barras o escribí el SKU..."
              value={ean}
              onChange={e => setEan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBuscarEan() }}
              autoFocus
              autoComplete="off"
            />
            <button
              onClick={handleBuscarEan}
              disabled={buscando}
              className="px-5 rounded-lg bg-gray-800 text-white font-medium disabled:opacity-50"
            >
              Buscar
            </button>
          </div>
          {buscando && <div className="text-sm text-gray-400 mt-1">Buscando...</div>}
          {errorBusqueda && <div className="text-sm text-red-600 mt-1">{errorBusqueda}</div>}
        </div>

        {producto && (
          <div className="p-4 bg-gray-50 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-gray-800">{producto.nombre}</div>
              {producto.fuente_descripcion && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  producto.fuente_descripcion === 'ia' ? 'bg-indigo-50 text-indigo-700' : 'bg-green-50 text-green-700'
                }`}>
                  {producto.fuente_descripcion === 'ia' ? 'Generado por IA' : 'Ficha de la tienda'}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>SKU {producto.sku}</span>
              {producto.marca && <span>Marca: {producto.marca}</span>}
              {producto.rubro && <span>{producto.rubro}{producto.sub_rubro ? ` / ${producto.sub_rubro}` : ''}</span>}
              <span className={producto.stock > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                Stock: {producto.stock}
              </span>
            </div>
            {producto.descripcion_html && (
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: producto.descripcion_html }}
              />
            )}
          </div>
        )}

        <div>
          <label className="label">Precio del artículo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              className="input-field pl-8 text-2xl font-bold"
              placeholder="0"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              min="0"
            />
          </div>
          {precioNum > 0 && (
            <div className="text-sm text-green-700 mt-1">
              Precio en efectivo (10% off): <span className="font-semibold">{formatMoneda(precioEfectivo)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="label mb-2">Entrega inicial</label>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { val: '0', label: 'Sin entrega' },
              { val: '20', label: '20%' },
              { val: '30', label: '30%' },
              { val: 'custom', label: 'Personalizada' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setModoEntrega(val)}
                className={`px-5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  modoEntrega === val
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
            {modoEntrega === 'custom' && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-sm font-medium">$</span>
                <input
                  type="number"
                  className="input-field w-32 text-sm"
                  placeholder="Monto exacto"
                  value={pctCustom}
                  onChange={e => setPctCustom(e.target.value)}
                  min="0"
                />
              </div>
            )}
          </div>

          {precioNum > 0 && (
            <div className="flex flex-wrap gap-6 mt-4 p-4 bg-gray-50 rounded-xl">
              {entrega > 0 && (
                <div>
                  <div className="text-xs text-gray-500">
                    Entrega{pct ? ` (${pct}%)` : ''}
                  </div>
                  <div className="font-bold text-gray-900 text-lg">{formatMoneda(entrega)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Monto a financiar</div>
                <div className="font-bold text-orange-700 text-2xl">{formatMoneda(aFinanciar)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PowerCred */}
      {hayImporte && (
        <div className="card p-0 overflow-hidden">
          <button
            onClick={() => toggle('powercred')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-gray-800">PowerCred</span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${abiertos.powercred ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {abiertos.powercred && (
            <div className="border-t border-gray-100 p-4 space-y-4">
              {/* Rubro */}
              <div>
                <label className="label mb-3">Rubro</label>
                <div className="flex gap-3 flex-wrap">
                  {config.gruposTasa.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setRubro(g.id)}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 text-left transition-colors min-w-32 ${
                        rubro === g.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{g.nombre}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-secciones por período */}
              <div className="space-y-3">
                {Object.entries(PLANES).map(([peri, { label, opciones }]) => (
                  <div key={peri} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggle(peri)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-semibold text-gray-700 text-sm">{label}</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${abiertos[peri] ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {abiertos[peri] && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-2 px-5 text-gray-500 font-medium">Cuotas</th>
                              <th className="text-center py-2 px-3 text-gray-500 font-medium">Tasa</th>
                              <th className="text-center py-2 px-5 text-gray-500 font-medium">Valor por cuota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas(peri, opciones).map(({ n, tasa, cuota }) => (
                              <tr key={n} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                                <td className="py-3 px-5 font-bold text-gray-700">{n} cuotas</td>
                                <td className="py-3 px-3 text-center">
                                  {tasa === 0
                                    ? <span className="text-green-600 font-semibold text-xs">sin interés</span>
                                    : <span className="text-gray-400 text-xs">{tasa}%</span>
                                  }
                                </td>
                                <td className="py-3 px-5 text-center font-bold text-gray-900 text-lg">{formatMoneda(cuota)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta de crédito */}
      {hayImporte && (
        <div className="card p-0 overflow-hidden">
          <button
            onClick={() => setAbiertos(prev => ({ ...prev, tarjeta: !prev.tarjeta }))}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="font-bold text-gray-800">Tarjeta de Crédito</span>
              <span className="text-xs text-gray-400 font-normal">solo consulta</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${abiertos.tarjeta ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {abiertos.tarjeta && (
            <div className="border-t border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-5 text-gray-500 font-medium">Cuotas</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">Tasa</th>
                    <th className="text-center py-2 px-5 text-gray-500 font-medium">Valor por cuota</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grupoTarjetaActual.tarjeta).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, tasa]) => {
                    const { cuota } = calcularCuota(aFinanciar, tasa, Number(n))
                    return (
                      <tr key={n} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-5 font-bold text-gray-700">{n} cuotas</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {tasa === 0
                              ? <span className="text-green-600 font-semibold text-xs">sin interés</span>
                              : <span className="text-gray-400 text-xs">{tasa}%</span>
                            }
                            {esCuotaTarjetaNaranja(n) && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">
                                Solo Naranja
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-5 text-center font-bold text-gray-900 text-lg">{formatMoneda(cuota)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Imprimir */}
      {hayImporte && (
        <div className="flex justify-center pb-6">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors font-medium shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir para el cliente
          </button>
        </div>
      )}

      {!precioNum && (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🧮</div>
          <div className="font-medium">Ingresá el precio del artículo para ver las opciones de financiación</div>
        </div>
      )}
    </div>
  )
}
