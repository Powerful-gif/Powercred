import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatMoneda, formatFecha, celularWhatsApp } from '../../lib/formatters'
import { calcularCapacidadDisponible } from '../../lib/calculos'
import { useConfig } from '../../context/ConfigContext'

const ESTADO_BADGE = {
  activo:      { cls: 'badge-activo',      label: 'Al día' },
  atrasado:    { cls: 'badge-atrasado',    label: 'Atrasado' },
  mora:        { cls: 'badge-mora',        label: 'En mora' },
  incobrable:  { cls: 'badge-incobrable',  label: 'Incobrable' },
  cancelado:   { cls: 'badge-cancelado',   label: 'Cancelado' },
}

export default function FichaCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTasa } = useConfig()
  const [cliente, setCliente] = useState(null)
  const [creditos, setCreditos] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmIncobrable, setConfirmIncobrable] = useState(null)
  const [periPotencial, setPeriPotencial] = useState('mensual')

  useEffect(() => {
    loadCliente()
  }, [id])

  async function loadCliente() {
    setLoading(true)
    const { data: cli } = await supabase.from('clientes').select('*').eq('id', id).single()
    const { data: creds } = await supabase
      .from('creditos')
      .select('*')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
    setCliente(cli)
    setCreditos(creds || [])
    setLoading(false)
  }

  async function marcarIncobrable(creditoId) {
    await supabase.from('creditos').update({ estado: 'incobrable' }).eq('id', creditoId)
    setConfirmIncobrable(null)
    loadCliente()
  }

  function whatsappUrl(cuotaInfo) {
    const num = celularWhatsApp(cliente?.celular)
    const primerCredito = creditos.find(c => ['activo', 'atrasado', 'mora'].includes(c.estado))
    const msg = encodeURIComponent(
      `Hola ${cliente?.nombre}, te recordamos que tenés una cuota vencida de ${cuotaInfo} correspondiente al crédito ${primerCredito?.numero_credito || ''}. Por favor comunicate con nosotros. Gracias - POWERFUL`
    )
    return `https://wa.me/${num}?text=${msg}`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="text-gray-400">Cargando...</div>
    </div>
  )

  if (!cliente) return (
    <div className="text-center py-12 text-gray-400">Cliente no encontrado</div>
  )

  const creditosActivos = creditos.filter(c => ['activo', 'atrasado', 'mora'].includes(c.estado))
  const capacidad = calcularCapacidadDisponible(cliente.capacidad_pago_mensual, creditosActivos)

  const estadoGeneral = creditos.length === 0 ? 'activo' :
    creditos.some(c => c.estado === 'incobrable') ? 'incobrable' :
    creditos.some(c => c.estado === 'mora') ? 'mora' :
    creditos.some(c => c.estado === 'atrasado') ? 'atrasado' : 'activo'

  const badge = ESTADO_BADGE[estadoGeneral] || ESTADO_BADGE.activo

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/clientes" className="text-gray-400 hover:text-gray-600 text-sm">← Volver</Link>
      </div>

      {/* Encabezado */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-800 font-bold text-xl">
                {cliente.apellido[0]}{cliente.nombre[0]}
              </span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">
                {cliente.apellido}, {cliente.nombre}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-sm text-blue-700">{cliente.codigo}</span>
                <span className="text-gray-400">·</span>
                <span className="text-sm text-gray-600">DNI: {cliente.dni}</span>
                <span className="text-gray-400">·</span>
                <span className={badge.cls}>{badge.label}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/clientes/${id}/editar`} className="btn-secondary text-sm">
              Editar
            </Link>
            <a
              href={whatsappUrl('una cuota')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500">Celular</div>
            <div className="font-medium text-sm">{cliente.celular}</div>
            {cliente.celular_alternativo && (
              <div className="text-xs text-gray-500">{cliente.celular_alternativo}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">Domicilio</div>
            <div className="font-medium text-sm">{cliente.domicilio}</div>
            <div className="text-xs text-gray-500">{cliente.localidad}, {cliente.provincia}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Alta</div>
            <div className="font-medium text-sm">{formatFecha(cliente.created_at?.split('T')[0])}</div>
          </div>
        </div>

        {/* Capacidad de pago */}
        {capacidad && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2 font-medium">Capacidad de Pago Mensual</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600">Total</div>
                <div className="font-bold text-blue-800">{formatMoneda(capacidad.total)}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-600">Comprometido</div>
                <div className="font-bold text-orange-700">{formatMoneda(capacidad.comprometido)}</div>
              </div>
              <div className={`rounded-lg p-3 ${capacidad.disponible < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`text-xs ${capacidad.disponible < 0 ? 'text-red-600' : 'text-green-600'}`}>Disponible</div>
                <div className={`font-bold ${capacidad.disponible < 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {formatMoneda(capacidad.disponible)}
                </div>
              </div>
            </div>

            {/* Potencial de crédito */}
            {capacidad.disponible > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500 font-medium">¿Cuánto puede sacar? (Hogar)</div>
                  <div className="flex gap-1">
                    {['mensual', 'quincenal', 'semanal'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriPotencial(p)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                          periPotencial === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                    const opciones = { mensual: [3,6,9,12], quincenal: [4,6,8,10,12], semanal: [4,8,12,16,20,24] }[periPotencial]
                    const gridClass = periPotencial === 'semanal' ? 'grid-cols-3' : periPotencial === 'quincenal' ? 'grid-cols-5' : 'grid-cols-4'
                    const cuotaMaxPeriodo = periPotencial === 'mensual' ? capacidad.disponible : periPotencial === 'quincenal' ? capacidad.disponible / 2 : capacidad.disponible / 4.33
                    return (
                      <div className={`grid ${gridClass} gap-2`}>
                        {opciones.map(n => {
                          const tasa = getTasa('hogar', periPotencial, n)
                          const importeMax = Math.floor(cuotaMaxPeriodo * n / (1 + tasa / 100))
                          return (
                            <div key={n} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                              <div className="text-xs font-semibold text-gray-700">{n} cuotas</div>
                              <div className="text-xs text-gray-400 mb-1">{tasa > 0 ? `${tasa}%` : 'sin interés'}</div>
                              <div className="font-bold text-blue-800 text-sm">{formatMoneda(importeMax)}</div>
                              <div className="text-xs text-gray-400 mt-0.5">máx.</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial de créditos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Historial de Créditos</h3>
          <Link
            to={`/creditos/nuevo?cliente=${id}`}
            className="btn-primary text-sm"
          >
            + Nuevo Crédito
          </Link>
        </div>

        {creditos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin créditos registrados</p>
        ) : (
          <div className="space-y-3">
            {creditos.map(cred => {
              const b = ESTADO_BADGE[cred.estado] || ESTADO_BADGE.activo
              return (
                <div key={cred.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-blue-700">
                          {cred.numero_credito}
                        </span>
                        <span className={b.cls}>{b.label}</span>
                        <span className="text-xs text-gray-400 capitalize">
                          {cred.tipo === 'hogar' ? 'Crédito del Hogar' : 'Préstamo en Efectivo'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {cred.cantidad_cuotas} cuotas {cred.periodicidad}s · {formatMoneda(cred.importe_cuota)} c/u
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Inicio: {formatFecha(cred.fecha_inicio)} · Tasa: {cred.tasa_interes_porcentaje}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{formatMoneda(cred.total_con_intereses)}</div>
                      <div className="text-xs text-gray-400">total crédito</div>
                      <div className="flex gap-2 mt-2">
                        <Link to={`/creditos/${cred.id}`}
                          className="text-blue-600 hover:underline text-xs">
                          Ver detalle
                        </Link>
                        {cred.estado !== 'incobrable' && cred.estado !== 'cancelado' && (
                          <button
                            onClick={() => setConfirmIncobrable(cred.id)}
                            className="text-red-500 hover:underline text-xs"
                          >
                            Incobrable
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal confirmar incobrable */}
      {confirmIncobrable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="font-bold text-gray-900 mb-2">¿Marcar como incobrable?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Este crédito pasará a estado <strong>incobrable</strong>. Esta acción indica que el crédito fue derivado a gestión legal o abogado.
            </p>
            <div className="flex gap-3">
              <button onClick={() => marcarIncobrable(confirmIncobrable)}
                className="btn-danger flex-1">
                Confirmar
              </button>
              <button onClick={() => setConfirmIncobrable(null)}
                className="btn-secondary flex-1">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
