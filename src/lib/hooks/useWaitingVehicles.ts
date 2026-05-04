// ── useWaitingVehicles ──────────────────────────────────────────

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { PendingConfirmation } from '@/types'

export function useWaitingVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const supabase                = getClient()
 
  const fetch = async () => {
    const { data } = await supabase
      .from('active_vehicles')
      .select('*')
    setVehicles(data || [])
    setLoading(false)
  }
 
  useEffect(() => {
    fetch()
    const channel = supabase
      .channel('weighings_changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'weighings',
      }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])
 
  return { vehicles, loading, refetch: fetch }
}