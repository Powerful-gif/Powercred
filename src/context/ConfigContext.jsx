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
    hogar: {
      mensual: { 3: 12, 6: 24, 9: 42, 12: 60 },
      quincenal: { 4: 8, 6: 12, 8: 16, 10: 20, 12: 24 },
      semanal: { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24 }
    },
    efectivo: {
      mensual: { 3: 24, 6: 48, 9: 72 },
      quincenal: { 4: 16, 6: 24, 8: 32, 10: 40, 12: 48 },
      semanal: { 4: 8, 8: 16, 12: 24, 16: 32, 20: 40, 24: 48 }
    },
    colchones: {
      mensual: { 3: 0, 6: 0, 9: 18, 12: 24 },
      quincenal: { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0 },
      semanal: { 4: 0, 8: 0, 12: 0, 16: 0, 20: 0, 24: 0 }
    },
    movilidad: {
      mensual: { 3: 15, 6: 30, 9: 45, 12: 60 },
      quincenal: { 4: 10, 6: 15, 8: 20, 10: 25, 12: 30 },
      semanal: { 4: 5, 8: 10, 12: 15, 16: 20, 20: 25, 24: 30 }
    }
  }
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
        if (data.datos?.tasas) {
          merged.tasas = {
            hogar: { ...DEFAULT_CONFIG.tasas.hogar, ...data.datos.tasas?.hogar },
            efectivo: { ...DEFAULT_CONFIG.tasas.efectivo, ...data.datos.tasas?.efectivo },
            colchones: { ...DEFAULT_CONFIG.tasas.colchones, ...data.datos.tasas?.colchones },
            movilidad: { ...DEFAULT_CONFIG.tasas.movilidad, ...data.datos.tasas?.movilidad }
          }
        }
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

  return (
    <ConfigContext.Provider value={{ config, loading, saveConfig, getTasa }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig debe usarse dentro de ConfigProvider')
  return ctx
}
