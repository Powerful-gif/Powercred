import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
]

const EMPTY_FORM = {
  nombre: '', apellido: '', dni: '', celular: '', celular_alternativo: '',
  domicilio: '', codigo_postal: '', localidad: '', provincia: 'Córdoba',
  capacidad_pago_mensual: ''
}

export default function FormCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, userNombre } = useAuth()
  const isEdit = !!id
  const prefill = location.state?.prefill
  const solicitudId = location.state?.solicitudId
  const [form, setForm] = useState(prefill ? { ...EMPTY_FORM, ...prefill } : EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codigoGen, setCodigoGen] = useState('')

  useEffect(() => {
    if (isEdit) {
      loadCliente()
    } else {
      generarCodigo()
    }
  }, [id])

  async function generarCodigo() {
    const { data } = await supabase
      .from('clientes')
      .select('codigo')
      .order('created_at', { ascending: false })
      .limit(1)
    let siguiente = 1
    if (data && data.length > 0) {
      const ultimo = data[0].codigo
      const num = parseInt(ultimo.replace('CLI-', ''))
      if (!isNaN(num)) siguiente = num + 1
    }
    setCodigoGen(`CLI-${String(siguiente).padStart(4, '0')}`)
  }

  async function loadCliente() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').eq('id', id).single()
    if (data) {
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        dni: data.dni || '',
        celular: data.celular || '',
        celular_alternativo: data.celular_alternativo || '',
        domicilio: data.domicilio || '',
        codigo_postal: data.codigo_postal || '',
        localidad: data.localidad || '',
        provincia: data.provincia || 'Córdoba',
        capacidad_pago_mensual: data.capacidad_pago_mensual ?? ''
      })
      setCodigoGen(data.codigo)
    }
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validar DNI único
    if (!isEdit) {
      const { data: existe } = await supabase
        .from('clientes')
        .select('id')
        .eq('dni', form.dni)
        .single()
      if (existe) {
        setError('Ya existe un cliente con ese DNI.')
        setLoading(false)
        return
      }
    }

    const payload = {
      ...form,
      codigo: codigoGen,
      capacidad_pago_mensual: form.capacidad_pago_mensual !== '' ? Number(form.capacidad_pago_mensual) : null,
      ...(!isEdit && { propietario: isAdmin ? 'admin' : userNombre })
    }

    let error_db
    let nuevoClienteId
    if (isEdit) {
      const { error: e } = await supabase.from('clientes').update(payload).eq('id', id)
      error_db = e
    } else {
      const { data: creado, error: e } = await supabase.from('clientes').insert(payload).select('id').single()
      error_db = e
      nuevoClienteId = creado?.id
    }

    setLoading(false)
    if (error_db) {
      setError(error_db.message || 'Error al guardar el cliente')
    } else {
      if (solicitudId && nuevoClienteId) {
        await supabase.from('solicitudes_web').update({ estado: 'convertida', cliente_id: nuevoClienteId }).eq('id', solicitudId)
      }
      navigate('/clientes')
    }
  }

  const titulo = isEdit ? 'Editar Cliente' : 'Nuevo Cliente'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clientes" className="text-gray-400 hover:text-gray-600">
          ← Volver
        </Link>
        <h2 className="text-lg font-semibold text-gray-700">{titulo}</h2>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Código */}
        <div>
          <label className="label">Código</label>
          <input type="text" value={codigoGen} readOnly
            className="input-field bg-gray-50 text-gray-500 font-mono" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input type="text" name="nombre" value={form.nombre}
              onChange={handleChange} required className="input-field"
              placeholder="Ej: Juan" />
          </div>
          <div>
            <label className="label">Apellido *</label>
            <input type="text" name="apellido" value={form.apellido}
              onChange={handleChange} required className="input-field"
              placeholder="Ej: García" />
          </div>
        </div>

        <div>
          <label className="label">DNI *</label>
          <input type="text" name="dni" value={form.dni}
            onChange={handleChange} required className="input-field"
            placeholder="Ej: 30123456" maxLength={9} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Celular principal *</label>
            <input type="text" name="celular" value={form.celular}
              onChange={handleChange} required className="input-field"
              placeholder="Ej: 0351 1234567" />
          </div>
          <div>
            <label className="label">Celular alternativo</label>
            <input type="text" name="celular_alternativo" value={form.celular_alternativo}
              onChange={handleChange} className="input-field"
              placeholder="Opcional" />
          </div>
        </div>

        <div>
          <label className="label">Domicilio *</label>
          <input type="text" name="domicilio" value={form.domicilio}
            onChange={handleChange} required className="input-field"
            placeholder="Ej: San Martín 456" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Código postal</label>
            <input type="text" name="codigo_postal" value={form.codigo_postal}
              onChange={handleChange} className="input-field"
              placeholder="Ej: 5842" />
          </div>
          <div>
            <label className="label">Localidad *</label>
            <input type="text" name="localidad" value={form.localidad}
              onChange={handleChange} required className="input-field"
              placeholder="Ej: Almafuerte" />
          </div>
          <div>
            <label className="label">Provincia</label>
            <select name="provincia" value={form.provincia}
              onChange={handleChange} className="input-field">
              {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Capacidad de pago mensual</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input type="number" name="capacidad_pago_mensual" value={form.capacidad_pago_mensual}
              onChange={handleChange} className="input-field pl-7"
              placeholder="Dejar vacío si no aplica" min="0" step="0.01" />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Si se ingresa, se mostrará la capacidad disponible al crear créditos
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : isEdit ? 'Actualizar Cliente' : 'Crear Cliente'}
          </button>
          <Link to="/clientes" className="btn-secondary text-center flex-1">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
