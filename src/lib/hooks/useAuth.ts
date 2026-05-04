// ── useAuth ────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { PendingConfirmation } from '@/types'


export function useAuth() {
  const [user, setUser]   = useState<any>(null)
  const [role, setRole]   = useState<string>('operator')
  const supabase          = getClient()
 
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setRole(data.user?.user_metadata?.role || 'operator')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setRole(session?.user?.user_metadata?.role || 'operator')
    })
    return () => listener.subscription.unsubscribe()
  }, [])
 
  const signOut = () => supabase.auth.signOut()
 
  return { user, role, signOut }
}
 