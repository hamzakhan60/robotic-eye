// src/components/operator/PendingCard.tsx
// KEY FIX: pass real operator ID from auth to both RPCs
// KEY FIX: pass weighing_id from matchedEntry for confirm_return
'use client'
import { useState, useEffect } from 'react'
import { useOperatorStore } from '@/stores/operatorStore'
import { useConfirm }       from '@/lib/hooks/useConfirm'
import { useAuth }          from '@/lib/hooks/useAuth'
import { SnapshotLightbox } from '@/components/operator/SnapshotLightbox'
import type { PendingConfirmation, WaitingEntry } from '@/types'

interface Props {
  pending:   PendingConfirmation
  onSuccess: (data: any) => void
}

export function PendingCard({ pending, onSuccess }: Props) {
  const { confirmEntry, confirmReturn, loading } = useConfirm()
  const { openReturnModal, setShowDismissModal } = useOperatorStore()
  const { user } = useAuth()

  const [plate,         setPlate]         = useState('')
  const [weight,        setWeight]        = useState(pending.weight_ocr || '')
  const [lightbox,      setLightbox]      = useState<string | null>(null)
  const [plateFocused,  setPlateFocused]  = useState(false)
  const [weightFocused, setWeightFocused] = useState(false)
  const [rpcError,      setRpcError]      = useState<string | null>(null)

  const weightEdited = weight !== (pending.weight_ocr || '')
  const hasWaiting   = (pending.waiting_list || []).length > 0

  const matchedEntry: WaitingEntry | undefined = plate.length >= 3
    ? (pending.waiting_list || []).find(w =>
        w.plate_number.replace(/[^A-Z0-9]/gi, '').toUpperCase() ===
        plate.replace(/[^A-Z0-9]/gi, '').toUpperCase()
      )
    : undefined

  const netPreview = matchedEntry && parseFloat(weight) > 0
    ? matchedEntry.loaded_weight - parseFloat(weight)
    : null

  const getOperatorId = async (): Promise<string | null> => {
    if (!user?.id) return null
    const { getClient } = await import('@/lib/supabase/client')
    const { data } = await getClient()
      .from('operators')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    return data?.id || null
  }

  const handleEntry = async () => {
    if (!plate || !weight) return
    setRpcError(null)
    const operatorId = await getOperatorId()

    const result = await confirmEntry({
      p_pending_id:       pending.id,
      p_plate:            plate.toUpperCase(),
      p_weight_kg:        parseFloat(weight),
      p_plate_edited:     false,
      p_weight_edited:    weightEdited,
      p_plate_ocr_raw:    pending.plate_ocr    || '',
      p_plate_ocr_conf:   pending.plate_conf   || 0,
      p_weight_ocr_raw:   pending.weight_ocr   || '',
      p_weight_ocr_conf:  pending.weight_conf  || 0,
      p_operator_id:      operatorId,
      p_outdoor_snapshot: pending.outdoor_snapshot_url,
      p_indoor_snapshot:  pending.indoor_snapshot_url,
    })

    if (result?.success) {
      onSuccess({ ...result, type: 'entry' })
    } else {
      setRpcError(result?.error || 'Entry failed')
    }
  }

  const handleReturn = async () => {
    if (!matchedEntry || !weight) return
    setRpcError(null)
    console.log('matchedEntry:', matchedEntry)
    console.log('weighing_id:', matchedEntry.weighing_id)
    const operatorId = await getOperatorId()

    const result = await confirmReturn({
      p_pending_id:          pending.id,
      p_weighing_id:         matchedEntry.weighing_id ?? matchedEntry.id,
      p_empty_weight_kg:     parseFloat(weight),
      p_weight_edited:       weightEdited,
      p_operator_id:         operatorId,
      p_ocr_plate_back:      plate.toUpperCase(),
      p_ocr_plate_back_conf: 1.0,
      p_match_method:        'operator_typed',
      p_weight_ocr_raw:      pending.weight_ocr  || '',
      p_weight_ocr_conf:     pending.weight_conf || 0,
      p_return_snapshot:     pending.outdoor_snapshot_url,
      p_indoor_snapshot:     pending.indoor_snapshot_url,
    })

    if (result?.success) {
      onSuccess({ ...result, type: 'return' })
    } else {
      setRpcError(result?.error || 'Return failed')
    }
  }

  const borderColor = matchedEntry ? '#059669'
    : plate.length > 0 ? '#2563EB' : '#E2E8F0'

  return (
    <>
      <style>{`
        /* Snapshots: 2 columns on desktop, stack on mobile */
        .pc-snapshots {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* Weight reading font size */
        .pc-weight-value {
          font-size: 36px;
          font-weight: 700;
          color: #0F172A;
          font-family: DM Mono, monospace;
        }
        .pc-weight-input {
          font-size: 36px;
          font-weight: 700;
          color: #0F172A;
          font-family: DM Mono, monospace;
          border: none;
          border-bottom: 2px solid #2563EB;
          background: transparent;
          outline: none;
          width: 200px;
        }

        /* Plate input font size */
        .pc-plate-input {
          width: 100%;
          height: 52px;
          padding: 0 16px;
          font-family: DM Mono, monospace;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: #0F172A;
          border-radius: 8px;
          outline: none;
          background: white;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        /* Context strip time — hide on very small screens */
        .pc-strip-time {
          font-size: 12px;
          color: #94A3B8;
          font-family: DM Mono, monospace;
        }

        /* ── Tablet (≤ 700px) ── */
        @media (max-width: 700px) {
          .pc-weight-value { font-size: 28px; }
          .pc-weight-input { font-size: 28px; width: 160px; }
          .pc-plate-input  { font-size: 18px; height: 48px; }
        }

        /* ── Mobile (≤ 480px) ── */
        @media (max-width: 480px) {
          .pc-snapshots    { grid-template-columns: 1fr; }
          .pc-weight-value { font-size: 24px; }
          .pc-weight-input { font-size: 24px; width: 140px; }
          .pc-plate-input  { font-size: 16px; height: 48px; }
          .pc-strip-time   { display: none; }
        }
      `}</style>

      {lightbox && (
        <SnapshotLightbox
          url={lightbox}
          outdoor={pending.outdoor_snapshot_url}
          indoor={pending.indoor_snapshot_url}
          onClose={() => setLightbox(null)}
        />
      )}

      <div style={{
        background: 'white', border: '1px solid #E2E8F0',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* Context strip */}
        <div style={{
          padding: '10px 20px',
          background: matchedEntry ? '#F0FDF4' : hasWaiting ? '#FFFBEB' : '#EFF6FF',
          borderBottom: `1px solid ${matchedEntry ? '#BBF7D0' : hasWaiting ? '#FDE68A' : '#BFDBFE'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: matchedEntry ? '#059669' : hasWaiting ? '#D97706' : '#2563EB',
            }} />
            <span style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
              color: matchedEntry ? '#065F46' : hasWaiting ? '#92400E' : '#1E40AF',
            }}>
              {matchedEntry ? `RETURN — ${matchedEntry.token_number}`
               : hasWaiting ? 'VEHICLES ON SITE — CHECK IF RETURN'
               : 'NEW ENTRY'}
            </span>
          </div>
          <span className="pc-strip-time">
            {new Date(pending.triggered_at || pending.created_at)
              .toLocaleTimeString('en-GB')}
          </span>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Snapshots */}
          <div className="pc-snapshots">
            {[
              { url: pending.outdoor_snapshot_url, label: 'PLATE CAMERA' },
              { url: pending.indoor_snapshot_url,  label: 'SCALE DISPLAY' },
            ].map(({ url, label }) => (
              <div key={label}>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 6,
                }}>
                  {label}
                </div>
                <button
                  onClick={() => url && setLightbox(url)}
                  style={{
                    width: '100%', aspectRatio: '16/9', borderRadius: 8,
                    overflow: 'hidden', border: '1px solid #E2E8F0',
                    cursor: url ? 'zoom-in' : 'default',
                    background: '#F8F9FA', padding: 0, display: 'block',
                  }}>
                  {url
                    ? <img src={url} alt={label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#CBD5E1', fontSize: 12,
                      }}>No snapshot</div>
                  }
                </button>
              </div>
            ))}
          </div>

          {/* Weight */}
          <div style={{
            background: '#F8F9FA', borderRadius: 10,
            padding: '16px 20px', border: '1px solid #E2E8F0',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: '#94A3B8', marginBottom: 8,
            }}>
              SCALE READING
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {weightFocused ? (
                <input
                  className="pc-weight-input"
                  value={weight}
                  autoFocus
                  onChange={e => setWeight(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => setWeightFocused(false)}
                />
              ) : (
                <span className="pc-weight-value">
                  {weight ? parseInt(weight).toLocaleString() : '—'}
                </span>
              )}
              <span style={{ fontSize: 18, color: '#64748B', fontWeight: 500 }}>kg</span>
              <button
                onClick={() => setWeightFocused(true)}
                style={{
                  marginLeft: 4, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 4, color: '#94A3B8',
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: pending.weight_stable ? '#10B981' : '#F59E0B',
              }} />
              <span style={{ fontSize: 11, color: '#64748B', letterSpacing: '0.06em' }}>
                {pending.weight_stable ? 'STABLE' : 'UNSTABLE'}
              </span>
              {weightEdited && (
                <span style={{ fontSize: 11, color: '#D97706', marginLeft: 8 }}>
                  · Edited from OCR
                </span>
              )}
            </div>
          </div>

          {/* Plate input */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: '#94A3B8', marginBottom: 8,
            }}>
              VEHICLE PLATE
            </div>
            <input
              className="pc-plate-input"
              value={plate}
              onChange={e => { setPlate(e.target.value.toUpperCase()); setRpcError(null) }}
              onFocus={() => setPlateFocused(true)}
              onBlur={() => setPlateFocused(false)}
              placeholder="Type plate number..."
              maxLength={12}
              autoComplete="off"
              style={{
                border: `2px solid ${borderColor}`,
                boxShadow: plateFocused
                  ? `0 0 0 3px ${matchedEntry
                      ? 'rgba(5,150,105,0.1)' : 'rgba(37,99,235,0.1)'}`
                  : 'none',
              }}
            />
            {matchedEntry ? (
              <div style={{
                marginTop: 8, padding: '8px 12px', background: '#F0FDF4',
                borderRadius: 6, border: '1px solid #BBF7D0',
                fontSize: 13, color: '#065F46',
              }}>
                ✓ Matches <strong style={{ fontFamily: 'DM Mono, monospace' }}>
                  {matchedEntry.token_number}</strong>
                {' '}· loaded {matchedEntry.loaded_weight?.toLocaleString()} kg
                {netPreview !== null && netPreview > 0 && (
                  <span style={{ color: '#059669', marginLeft: 8, fontWeight: 700 }}>
                    · Net: {netPreview.toLocaleString()} kg
                  </span>
                )}
              </div>
            ) : plate.length >= 3 ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                No match in waiting list — will confirm as new entry
              </div>
            ) : null}
          </div>

          {/* RPC error */}
          {rpcError && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#DC2626',
            }}>
              {rpcError}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matchedEntry ? (
              <button
                onClick={handleReturn}
                disabled={loading || !plate || !weight}
                style={{
                  height: 52,
                  background: loading ? '#6EE7B7' : '#059669',
                  color: 'white', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
                  cursor: loading || !plate || !weight ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                {loading
                  ? 'SAVING...'
                  : `CONFIRM RETURN${netPreview && netPreview > 0
                      ? ` · Net ${netPreview.toLocaleString()} kg` : ''}`}
              </button>
            ) : (
              <button
                onClick={handleEntry}
                disabled={loading || !plate || !weight}
                style={{
                  height: 52,
                  background: loading || !plate || !weight ? '#93C5FD' : '#2563EB',
                  color: 'white', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
                  cursor: loading || !plate || !weight ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                {loading ? 'SAVING...' : 'CONFIRM ENTRY'}
              </button>
            )}

            <div style={{ display: 'grid' }}>
              <button
                onClick={() => setShowDismissModal(true)}
                disabled={loading}
                style={{
                  height: 44, background: 'white', color: '#DC2626',
                  border: '1.5px solid #FECACA', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                DISMISS
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}