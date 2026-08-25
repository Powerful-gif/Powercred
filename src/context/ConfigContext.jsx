import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_CONFIG = {
  negocio: {
    nombre: 'POWERFUL',
    subtitulo: 'PRÉSTAMOS',
    direccion: 'Pedro C. Molina N° 318',
    localidad: 'Almafuerte',
    provincia: 'Córdoba',
    telefono: ''
  },
  pagare: {
    localidad: 'Almafuerte',
    acreedor: 'Secchiari Caroline',
    cuit: '27-17111940-0',
    direccion: 'Pedro C. Molina N° 318',
    ciudad: 'Almafuerte'
  },
  mora: { tasa_diaria: 0.3 },
  tasas: {
    efectivo: {
      mensual: { 3: 24, 6: 48, 9: 72 },
      quincenal: { 4: 16, 6: 24, 8: 32, 10: 40, 12: 48 },
      semanal: { 4: 8, 8: 16, 12: 24, 16: 32, 20: 40, 24: 48 }
    }
  },
  // Grupos de PowerCred: cada rubro de Dux pertenece a uno (o al "General"
  // por defecto si no matchea ninguno). Definen las tasas mensual/quincenal/semanal.
  gruposTasa: [
    {
      id: 'general',
      nombre: 'General',
      esDefault: true,
      rubrosDux: [],
      descuentoEfectivo: 10,
      descuentoTransferencia: 0,
      powercred: {
        mensual: { 3: 12, 6: 24, 9: 42, 12: 60 },
        quincenal: { 4: 8, 6: 12, 8: 16, 10: 20, 12: 24 },
        semanal: { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24 }
      }
    },
    {
      id: 'colchones',
      nombre: 'Colchones y Sillones',
      esDefault: false,
      rubrosDux: ['COLCHONES Y SOMMIERS'],
      descuentoEfectivo: 20,
      descuentoTransferencia: 10,
      powercred: {
        mensual: { 3: 0, 6: 0, 9: 18, 12: 24 },
        quincenal: { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0 },
        semanal: { 4: 0, 8: 0, 12: 0, 16: 0, 20: 0, 24: 0 }
      }
    }
  ],
  // Grupos de Tarjeta de Crédito: totalmente independientes de los de
  // PowerCred, con su propia asignación de rubros de Dux y su propio "General".
  // Las claves de "tarjeta" son la cantidad de cuotas, pero una cuota
  // exclusiva de tarjeta Naranja se guarda como "N-naranja" (ej: "9-naranja")
  // para poder convivir con la tasa "9" de cualquier otra tarjeta.
  gruposTarjeta: [
    {
      id: 'general',
      nombre: 'General',
      esDefault: true,
      rubrosDux: [],
      tarjeta: { 3: 0, '4-naranja': 0, '5-naranja': 0, 6: 0, 9: 9, '9-naranja': 0, 12: 13, '14-naranja': 0 }
    },
    {
      id: 'recargo_14_cuotas',
      nombre: 'Recargo 14 cuotas',
      esDefault: false,
      rubrosDux: ['CLIMATIZACION', 'COCINAS Y HORNOS', 'HELADERAS Y FREEZERS', 'LAVADO', 'TECNOLOGIA', 'TV, AUDIO Y VIDEO', 'MOVILIDAD'],
      tarjeta: { 3: 0, '4-naranja': 0, '5-naranja': 0, 6: 0, 9: 9, '9-naranja': 0, 12: 13, '14-naranja': 10 }
    }
  ]
}

const ConfigContext = createContext(null)

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('datos')
        .eq('id', 'global')
        .single()
      if (!error && data?.datos) {
        const merged = { ...DEFAULT_CONFIG, ...data.datos }
        merged.tasas = {
          efectivo: { ...DEFAULT_CONFIG.tasas.efectivo, ...data.datos.tasas?.efectivo }
        }
        merged.gruposTasa = (data.datos.gruposTasa && data.datos.gruposTasa.length)
          ? data.datos.gruposTasa
          : DEFAULT_CONFIG.gruposTasa
        merged.gruposTarjeta = (data.datos.gruposTarjeta && data.datos.gruposTarjeta.length)
          ? data.datos.gruposTarjeta
          : DEFAULT_CONFIG.gruposTarjeta
        setConfig(merged)
      }
    } catch (e) {
      console.warn('Usando configuración por defecto')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig(newConfig) {
    const merged = { ...config, ...newConfig }
    setConfig(merged)
    try {
      await supabase.from('configuracion').upsert({
        id: 'global',
        datos: merged,
        updated_at: new Date().toISOString()
      })
    } catch (e) {
      console.error('Error guardando configuración', e)
    }
  }

  function getTasa(tipo, periodicidad, cuotas) {
    try {
      const tasas = config.tasas[tipo][periodicidad]
      return tasas[cuotas] ?? 0
    } catch {
      return 0
    }
  }

  function getGrupo(grupoId) {
    return config.gruposTasa.find(g => g.id === grupoId)
      || config.gruposTasa.find(g => g.esDefault)
      || config.gruposTasa[0]
  }

  function getTasaGrupo(grupoId, periodicidad, cuotas) {
    try {
      return getGrupo(grupoId).powercred[periodicidad][cuotas] ?? 0
    } catch {
      return 0
    }
  }

  function getGrupoTarjeta(grupoId) {
    return config.gruposTarjeta.find(g => g.id === grupoId)
      || config.gruposTarjeta.find(g => g.esDefault)
      || config.gruposTarjeta[0]
  }

  function getTasaTarjetaGrupo(grupoId, cuotas) {
    try {
      return getGrupoTarjeta(grupoId).tarjeta[cuotas] ?? 0
    } catch {
      return 0
    }
  }

  function esCuotaTarjetaNaranja(clave) {
    return String(clave).endsWith('-naranja')
  }

  function cuotasDeClaveTarjeta(clave) {
    return parseInt(clave, 10)
  }

  function detectarGrupoPorRubroDux(rubroDux) {
    const match = config.gruposTasa.find(g => (g.rubrosDux || []).includes(rubroDux))
    if (match) return match.id
    const porDefecto = config.gruposTasa.find(g => g.esDefault)
    return porDefecto ? porDefecto.id : config.gruposTasa[0]?.id
  }

  function detectarGrupoTarjetaPorRubroDux(rubroDux) {
    const match = config.gruposTarjeta.find(g => (g.rubrosDux || []).includes(rubroDux))
    if (match) return match.id
    const porDefecto = config.gruposTarjeta.find(g => g.esDefault)
    return porDefecto ? porDefecto.id : config.gruposTarjeta[0]?.id
  }

  return (
    <ConfigContext.Provider value={{
      config, loading, saveConfig, getTasa,
      getGrupo, getTasaGrupo, detectarGrupoPorRubroDux,
      getGrupoTarjeta, getTasaTarjetaGrupo, esCuotaTarjetaNaranja, cuotasDeClaveTarjeta, detectarGrupoTarjetaPorRubroDux
    }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig debe usarse dentro de ConfigProvider')
  return ctx
}
