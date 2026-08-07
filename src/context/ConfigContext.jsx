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
  // Grupos de tasa: cada rubro de Dux pertenece a uno (o al "General" por
  // defecto si no matchea ninguno). Definen tanto las tasas de PowerCred
  // (mensual/quincenal/semanal) como las de Tarjeta de Crédito.
  gruposTasa: [
    {
      id: 'general',
      nombre: 'General',
      esDefault: true,
      rubrosDux: [],
      powercred: {
        mensual: { 3: 12, 6: 24, 9: 42, 12: 60 },
        quincenal: { 4: 8, 6: 12, 8: 16, 10: 20, 12: 24 },
        semanal: { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24 }
      },
      tarjeta: { 3: 0, 5: 0, 6: 0, 9: 0, 12: 20, 14: 0 }
    },
    {
      id: 'colchones',
      nombre: 'Colchones y Sillones',
      esDefault: false,
      rubrosDux: ['COLCHONES Y SOMMIERS'],
      powercred: {
        mensual: { 3: 0, 6: 0, 9: 18, 12: 24 },
        quincenal: { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0 },
        semanal: { 4: 0, 8: 0, 12: 0, 16: 0, 20: 0, 24: 0 }
      },
      tarjeta: { 3: 0, 5: 0, 6: 0, 9: 0, 12: 20, 14: 0 }
    }
  ]
}

// Cuotas de tarjeta que solo aceptan tarjeta Naranja (fijo, no depende del grupo)
const CUOTAS_TARJETA_NARANJA = [5, 9, 14]

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

  function getTasaTarjetaGrupo(grupoId, cuotas) {
    try {
      return getGrupo(grupoId).tarjeta[cuotas] ?? 0
    } catch {
      return 0
    }
  }

  function esCuotaTarjetaNaranja(cuotas) {
    return CUOTAS_TARJETA_NARANJA.includes(Number(cuotas))
  }

  function detectarGrupoPorRubroDux(rubroDux) {
    const match = config.gruposTasa.find(g => (g.rubrosDux || []).includes(rubroDux))
    if (match) return match.id
    const porDefecto = config.gruposTasa.find(g => g.esDefault)
    return porDefecto ? porDefecto.id : config.gruposTasa[0]?.id
  }

  return (
    <ConfigContext.Provider value={{
      config, loading, saveConfig, getTasa,
      getGrupo, getTasaGrupo, getTasaTarjetaGrupo, esCuotaTarjetaNaranja, detectarGrupoPorRubroDux
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
