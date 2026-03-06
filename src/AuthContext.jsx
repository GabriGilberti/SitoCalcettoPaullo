import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "./supabaseClient"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPlayer(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPlayer(session.user.id)
      else { setPlayer(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPlayer(userId) {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    setPlayer(data || null)
    setLoading(false)
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setPlayer(null)
  }

  const refreshPlayer = async () => {
    if (user) await loadPlayer(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, player, loading, signInWithGoogle, signOut, refreshPlayer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)