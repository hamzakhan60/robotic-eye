// src/lib/hooks/usePending.ts
// Fetches and subscribes to pending_confirmations in real time
 
import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { PendingConfirmation } from '@/types'
 
export function usePending() {
  const [pending, setPending]   = useState<PendingConfirmation[]>([])
  const [loading, setLoading]   = useState(true)
  const supabase                = getClient()
 
  const fetchPending = async () => {
    const { data } = await supabase
      .from('pending_confirmations')
      .select('*')
      .eq('status', 'pending')
      .order('triggered_at', { ascending: true })
    setPending((data as PendingConfirmation[]) || [])
    setLoading(false)
  }
 
  useEffect(() => {
    fetchPending()
 
    // Realtime subscription — operator screen updates instantly
    const channel = supabase
      .channel('pending_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_confirmations',
      }, () => {
        fetchPending()
      })
      .subscribe()
 
    return () => { supabase.removeChannel(channel) }
  }, [])
 
  return { pending, loading, refetch: fetchPending }
}