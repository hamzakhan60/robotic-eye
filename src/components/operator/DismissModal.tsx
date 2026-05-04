// src/components/operator/DismissModal.tsx
'use client'
import { useState } from 'react'
import { getClient }        from '@/lib/supabase/client'
import { useOperatorStore } from '@/stores/operatorStore'

const REASONS = [
  'False detection',
  'Duplicate entry',
  'Vehicle not on scale',
  'Wrong camera angle',
  'Other',
]

interface Props {
  pendingId:   string
  weightOcr:   string
  onDismissed: () => void
}

export function DismissModal({ pendingId, weightOcr, onDismissed }: Props) {
  const { setShowDismissModal } = useOperatorStore()
  const [reason,  setReason]  = useState('')
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!reason) return
    setLoading(true)
    const fullReason = reason === 'Other' && notes
      ? `Other: ${notes}` : reason

    const { data, error: rpcErr } = await getClient()
      .rpc('dismiss_pending', {
        p_pending_id: pendingId,
        p_reason:     fullReason,
      })

    if (rpcErr || !data?.success) {
      setError(rpcErr?.message || data?.error || 'Dismiss failed')
      setLoading(false)
      return
    }
    setShowDismissModal(false)
    onDismissed()
  }

  return (
    <>
      <style>{`
        /* Overlay */
        .dm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          zIndex: 200;
          backdrop-filter: blur(2px);
          padding: 16px;
          box-sizing: border-box;
        }

        /* Sheet */
        .dm-sheet {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          overflow: hidden;
          max-height: calc(100vh - 32px);
          display: flex;
          flex-direction: column;
        }

        /* Scrollable body */
        .dm-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
        }

        /* ── Mobile (≤ 540px): bottom sheet ── */
        @media (max-width: 540px) {
          .dm-overlay {
            align-items: flex-end;
            padding: 0;
          }
          .dm-sheet {
            max-width: 100%;
            border-radius: 16px 16px 0 0;
            max-height: 92vh;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
        }
      `}</style>

      <div className="dm-overlay">
        <div className="dm-sheet">

          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>
                Dismiss Detection
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                This action is logged and cannot be undone
              </div>
            </div>
            <button
              onClick={() => setShowDismissModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="dm-body">

            {/* Detection info */}
            <div style={{
              background: '#F8F9FA', borderRadius: 8, padding: '12px 16px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.08em' }}>
                DETECTION
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: '#0F172A', marginTop: 4,
                fontFamily: 'DM Mono, monospace',
              }}>
                {weightOcr ? `${parseInt(weightOcr).toLocaleString()} KG` : '—'}
              </div>
            </div>

            {/* Reason selection */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                color: '#64748B', marginBottom: 10,
              }}>
                REASON <span style={{ color: '#DC2626' }}>*</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REASONS.map(r => (
                  <button key={r} onClick={() => setReason(r)} type="button"
                    style={{
                      padding: '10px 14px', borderRadius: 8, textAlign: 'left',
                      cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                      border: `2px solid ${reason === r ? '#DC2626' : '#E2E8F0'}`,
                      background: reason === r ? '#FEF2F2' : 'white',
                      color: reason === r ? '#DC2626' : '#0F172A',
                      fontWeight: reason === r ? 600 : 400,
                      transition: 'all 0.12s',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes (only for Other) */}
            {reason === 'Other' && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                  color: '#64748B', marginBottom: 8,
                }}>
                  NOTES
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe why this detection is being dismissed..."
                  rows={3}
                  style={{
                    width: '100%', padding: 12, borderRadius: 8,
                    border: '1.5px solid #E2E8F0', fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif', resize: 'vertical',
                    outline: 'none', color: '#0F172A', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#DC2626',
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleConfirm}
                disabled={!reason || loading}
                style={{
                  height: 48,
                  background: !reason || loading ? '#FCA5A5' : '#DC2626',
                  color: 'white', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
                  cursor: !reason || loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                {loading ? 'DISMISSING...' : 'CONFIRM DISMISS'}
              </button>
              <button
                onClick={() => setShowDismissModal(false)}
                style={{
                  height: 44, background: 'white', border: '1.5px solid #E2E8F0',
                  borderRadius: 8, fontSize: 14, color: '#64748B',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>
                Cancel
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}