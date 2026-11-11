import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const COLUMNAS =
  '*, pp_personas(nombre, apellido, dni, celular), pp_participaciones(prestamista_id, monto, pp_prestamistas(nombre)), pp_cuotas(*), pp_pagos(*)'

export function usePrestamosPrivados() {
  const [estado, setEstado] = useState({ prestamos: [], prestamistas: [], cargando: true, error: '' })

  const recargar = useCallback(async () => {
    const [resPrestamos, resPrestamistas] = await Promise.all([
      supabase.from('pp_prestamos').select(COLUMNAS).order('numero', { ascending: false }),
      supabase.from('pp_prestamistas').select('*').order('nombre'),
    ])
    if (resPrestamos.error || resPrestamistas.error) {
      setEstado(prev => ({ ...prev, cargando: false, error: 'No se pudieron cargar los préstamos.' }))
      return
    }
    setEstado({ prestamos: resPrestamos.data, prestamistas: resPrestamistas.data, cargando: false, error: '' })
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { ...estado, recargar }
}
