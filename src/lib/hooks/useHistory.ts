// src/lib/hooks/useHistory.ts
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns'

export type DateFilter   = 'today' | 'week' | 'month' | 'custom'
export type StatusFilter = 'all' | 'waiting' | 'complete' | 'dismissed'

export interface AuditEntry {
  id: string; field: string; ocr_value: string | null
  operator_value: string | null; was_edited: boolean
  action: string; created_at: string
}

export interface Weighing {
  id: string; token_number: string; plate_number: string | null
  plate_ocr_raw: string | null; loaded_weight: number | null
  loaded_weight_ocr_raw: string | null; empty_weight: number | null
  empty_weight_ocr_raw: string | null; net_load: number | null
  status: string; entry_at: string; return_at: string | null
  entry_snapshot_url: string | null; return_snapshot_url: string | null
  flag_reason: string | null; plate_edited_by_operator: boolean
  loaded_weight_edited: boolean; empty_weight_edited: boolean
  last_edited_at: string | null; edit_count: number
  entry_indoor_snapshot_url:  string | null   
  return_indoor_snapshot_url: string | null 
}

export interface DismissedItem {
  id: string; weight_ocr: string | null; triggered_at: string
  outdoor_snapshot_url: string | null; indoor_snapshot_url: string | null
  status: string; dismiss_reason: string | null
}

export type HistoryRow =
  | (Weighing      & { _kind: 'weighing' })
  | (DismissedItem & { _kind: 'dismissed' })

interface UseHistoryOptions {
  dateFilter: DateFilter; statusFilter: StatusFilter
  customFrom?: string; customTo?: string
}

export function useHistory({ dateFilter, statusFilter, customFrom, customTo }: UseHistoryOptions) {
  const [weighings, setWeighings] = useState<Weighing[]>([])
  const [dismissed, setDismissed] = useState<DismissedItem[]>([])
  const [auditMap,  setAuditMap]  = useState<Record<string, AuditEntry[]>>({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const getFrom = () => {
    const now = new Date()
    if (dateFilter === 'today')  return startOfDay(now).toISOString()
    if (dateFilter === 'week')   return startOfWeek(now).toISOString()
    if (dateFilter === 'month')  return startOfMonth(now).toISOString()
    if (dateFilter === 'custom' && customFrom) return new Date(customFrom).toISOString()
    return startOfDay(now).toISOString()
  }

  const getTo = () => {
    if (dateFilter === 'custom' && customTo)
      return new Date(customTo + 'T23:59:59').toISOString()
    return null
  }

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const supabase = getClient()
    const from = getFrom(); const to = getTo()

    if (statusFilter !== 'dismissed') {
      let wq = supabase.from('weighings').select('*')
        .gte('entry_at', from).order('entry_at', { ascending: false }).limit(200)
      if (to) wq = wq.lte('entry_at', to)
      if (statusFilter === 'waiting')  wq = wq.eq('status', 'waiting')
      if (statusFilter === 'complete') wq = wq.eq('status', 'complete')

      const { data, error: wErr } = await wq
      if (wErr) { setError(wErr.message); setLoading(false); return }
      const rows = data || []
      setWeighings(rows)

      if (rows.length > 0) {
        const { data: auditData } = await supabase.from('audit_log').select('*')
          .in('weighing_id', rows.map(r => r.id))
          .order('created_at', { ascending: true })
        const map: Record<string, AuditEntry[]> = {}
        ;(auditData || []).forEach((a: any) => {
          if (!map[a.weighing_id]) map[a.weighing_id] = []
          map[a.weighing_id].push(a)
        })
        setAuditMap(map)
      } else { setAuditMap({}) }
    } else { setWeighings([]) }

    if (statusFilter === 'all' || statusFilter === 'dismissed') {
      let dq = supabase.from('pending_confirmations')
        .select('id,weight_ocr,triggered_at,outdoor_snapshot_url,indoor_snapshot_url,status,dismiss_reason')
        .eq('status', 'dismissed').gte('triggered_at', from)
        .order('triggered_at', { ascending: false })
      if (to) dq = dq.lte('triggered_at', to)
      const { data: dData } = await dq
      setDismissed(dData || [])
    } else { setDismissed([]) }

    setLoading(false)
  }, [dateFilter, statusFilter, customFrom, customTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  const rows: HistoryRow[] = [
    ...weighings.map(w => ({ ...w, _kind: 'weighing' as const })),
    ...(statusFilter === 'all' || statusFilter === 'dismissed'
      ? dismissed.map(d => ({ ...d, _kind: 'dismissed' as const }))
      : []),
  ].sort((a, b) => {
    const tA = a._kind === 'weighing' ? a.entry_at : a.triggered_at
    const tB = b._kind === 'weighing' ? b.entry_at : b.triggered_at
    return new Date(tB).getTime() - new Date(tA).getTime()
  })

  return { rows, auditMap, loading, error, refetch: fetchAll }
}