// src/lib/hooks/useConfirm.ts
import { useState } from 'react'
import { getClient } from '@/lib/supabase/client'

export function useConfirm() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const supabase              = getClient()

  const confirmEntry = async (payload: any) => {
    setLoading(true); setError(null)
    const { data, error } = await supabase.rpc('confirm_entry', payload)
    setLoading(false)
    if (error) { setError(error.message); return null }
    return data
  }

  const confirmReturn = async (payload: any) => {
    setLoading(true); setError(null)
    const { data, error } = await supabase.rpc('confirm_return', payload)
    setLoading(false)
    if (error) { setError(error.message); return null }
    return data
  }

  const dismiss = async (pendingId: string, reason?: string) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('dismiss_pending', {
      p_pending_id: pendingId,
      p_reason: reason || 'dismissed by operator',
    })
    setLoading(false)
    if (error) { setError(error.message); return null }
    return data
  }

  const getWaitingEntries = async (plate?: string) => {
    const { data } = await supabase.rpc('get_waiting_entries', {
      p_plate: plate || null
    })
    return data || []
  }

  return { confirmEntry, confirmReturn, dismiss, getWaitingEntries, loading, error }
}