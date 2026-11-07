import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acceso, setAcceso] = useState({ userId: null, valor: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let activo = true
    supabase
      .from('pp_acceso')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setAcceso({ userId: user.id, valor: !!data })
      })
    return () => { activo = false }
  }, [user?.id])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = user?.user_metadata?.role === 'admin'
  const userNombre = user?.user_metadata?.nombre || ''
  // null = todavía no se sabe si este usuario tiene acceso
  const accesoPrivado = !user ? false : acceso.userId === user.id ? acceso.valor : null

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAdmin, userNombre, accesoPrivado }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
