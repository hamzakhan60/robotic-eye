// src/components/operator/EditModal.tsx
// Handles editing of same-day weighings and dismissed records
'use client'
import { useState, useEffect } from 'react'
import { getClient } from '@/lib/supabase/client'
import { useAuth }   from '@/lib/hooks/useAuth'
import type { HistoryRow, Weighing, DismissedItem } from '@/lib/hooks/useHistory'

interface Props {
  row:       HistoryRow
  onClose:   () => void
  onSuccess: (result: any) => void
}

export function EditModal({ row, onClose, onSuccess }: Props) {
  const { user }              = useAuth()
  const isWeighing            = row._kind === 'weighing'
  const weighing              = isWeighing ? row as Weighing : null
  const dismissed             = !isWeighing ? row as DismissedItem : null

  const isSameDay = () => {
    const date = isWeighing
      ? new Date((row as Weighing).entry_at)
      : new Date((row as DismissedItem).triggered_at)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Pre-fill from existing record
  const [plate,    setPlate]   = useState(
    isWeighing ? (weighing?.plate_number || '') : ''
  )
  const [weight,   setWeight]  = useState(
    isWeighing
      ? (weighing?.status === 'waiting'
          ? (weighing?.loaded_weight?.toString() || '')
          : (weighing?.empty_weight?.toString() || ''))
      : (dismissed?.weight_ocr || '')
  )
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState<string | null>(null)
  const [matchMsg, setMatchMsg] = useState<string | null>(null)

  // Live match check as plate is typed
  useEffect(() => {
    if (plate.length < 3) { setMatchMsg(null); return }
    const supabase = getClient()
    supabase.from('weighings')
      .select('id,token_number,plate_number,loaded_weight')
      .eq('status', 'waiting')
      .ilike('plate_number', plate)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].plate_number?.toUpperCase() !== weighing?.plate_number?.toUpperCase()) {
          setMatchMsg(`Matches ${data[0].token_number} · ${data[0].loaded_weight?.toLocaleString()} kg loaded → will CONFIRM RETURN`)
        } else {
          setMatchMsg(null)
        }
      })
  }, [plate])

  const getOperatorId = async () => {
    if (!user?.id) return null
    const { data } = await getClient()
      .from('operators').select('id')
      .eq('auth_user_id', user.id).single()
    return data?.id || null
  }

  const handleSave = async () => {
    if (!plate && !weight) return
    setLoading(true)
    setError(null)

    const supabase    = getClient()
    const operatorId  = await getOperatorId()

    const payload: any = {
      p_plate:       plate.toUpperCase() || null,
      p_weight_kg:   weight ? parseFloat(weight) : null,
      p_operator_id: operatorId,
    }

    if (isWeighing) {
      payload.p_weighing_id = weighing!.id
    } else {
      payload.p_pending_id = dismissed!.id
    }

    const { data, error: rpcErr } = await supabase.rpc('edit_weighing', payload)

    if (rpcErr) { setError(rpcErr.message); setLoading(false); return }
    if (!data?.success) { setError(data?.error || 'Edit failed'); setLoading(false); return }

    onSuccess(data)
    onClose()
  }

  const canEdit = isSameDay()

  const statusLabel = isWeighing
    ? { waiting: 'Entry', complete: 'Return', flagged: 'Flagged', cancelled: 'Cancelled' }[weighing!.status] || weighing!.status
    : 'Dismissed'

  const weightLabel = isWeighing && weighing?.status !== 'waiting'
    ? 'EMPTY WEIGHT (kg)'
    : 'WEIGHT (kg)'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
              Edit {statusLabel}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {canEdit ? 'Same-day edit — changes are logged' : 'Read only — past day records cannot be edited'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94A3B8', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {!canEdit ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 14 }}>Records from previous days cannot be edited.</div>
          </div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Plate field */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                              color: '#64748B', display: 'block', marginBottom: 6 }}>
                VEHICLE PLATE
              </label>
              <input
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. PB10AB1234"
                maxLength={12}
                style={{
                  width: '100%', height: 48, padding: '0 14px',
                  fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 600,
                  letterSpacing: '0.06em', color: '#0F172A',
                  border: `2px solid ${matchMsg ? '#059669' : '#E2E8F0'}`,
                  borderRadius: 8, outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              />
              {matchMsg && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#059669',
                              background: '#F0FDF4', borderRadius: 6,
                              padding: '6px 10px', border: '1px solid #BBF7D0' }}>
                  ✓ {matchMsg}
                </div>
              )}
            </div>

            {/* Weight field */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                              color: '#64748B', display: 'block', marginBottom: 6 }}>
                {weightLabel}
              </label>
              <input
                value={weight}
                onChange={e => setWeight(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 24580"
                style={{
                  width: '100%', height: 48, padding: '0 14px',
                  fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 600,
                  color: '#0F172A', border: '2px solid #E2E8F0',
                  borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Logic explanation */}
            <div style={{ background: '#F8F9FA', borderRadius: 8,
                          padding: '10px 14px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B',
                            marginBottom: 4, letterSpacing: '0.06em' }}>
                SAVE LOGIC
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                {matchMsg
                  ? '→ Plate matches waiting vehicle — will confirm return'
                  : isWeighing && weighing?.status === 'waiting'
                    ? '→ Updates entry plate and loaded weight'
                    : !isWeighing
                      ? '→ Converts dismissed to entry (or return if plate matches)'
                      : '→ Updates return empty weight'}
              </div>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
                            borderRadius: 8, padding: '10px 14px',
                            fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={loading || (!plate && !weight)}
                style={{
                  flex: 1, height: 46,
                  background: loading ? '#93C5FD' : '#2563EB',
                  color: 'white', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                {loading ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button onClick={onClose}
                style={{
                  flex: 1, height: 46, background: 'white',
                  border: '1.5px solid #E2E8F0', borderRadius: 8,
                  fontSize: 13, color: '#64748B', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}