// src/app/(operator)/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { usePending }          from '@/lib/hooks/usePending'
import { useWaitingVehicles }  from '@/lib/hooks/useWaitingVehicles'
import { useOperatorStore }    from '@/stores/operatorStore'
import { PendingCard }         from '@/components/operator/PendingCard'
import { PendingIdle }         from '@/components/operator/PendingIdle'
import { VehicleOnSiteList }   from '@/components/operator/VehicleOnSiteList'
import { ReturnSelectionModal } from '@/components/operator/ReturnSelectionModal'
import { SuccessFlash }        from '@/components/operator/SuccessFlash'
import { DismissModal }        from '@/components/operator/DismissModal'
import type { PendingConfirmation, WaitingEntry } from '@/types'

export default function OperatorDashboard() {
  const { pending, loading: pl }  = usePending()
  const { vehicles, loading: vl } = useWaitingVehicles()
  const {
    activePending, setActivePending,
    showReturnModal, showSuccess,
    showDismissModal, setShowDismissModal,
  } = useOperatorStore()

  // Keep active pending in sync with realtime updates
  useEffect(() => {
    if (pending.length > 0) {
      const still = pending.find(p => p.id === activePending?.id)
      if (!still) setActivePending(pending[0])
    } else {
      setActivePending(null)
    }
  }, [pending])

  // Merge waiting vehicles into the active pending object
  const enrichedPending: PendingConfirmation | null = activePending
    ? {
        ...activePending,
        waiting_list: vehicles.map((v: any): WaitingEntry => ({
          id:            v.id,
          weighing_id:   v.weighing_id ?? v.id,
          plate_number:  v.plate_number,
          token_number:  v.token_number,
          loaded_weight: v.loaded_weight,
          entry_at:      v.entry_at,
        })),
      }
    : null

  const handleSuccess = (data: any) => {
    showSuccess({
      type:        data.type,
      tokenNumber: data.token_number || '',
      plate:       data.plate        || '',
      weightKg:    data.weight_kg,
      loadedKg:    data.loaded_kg,
      emptyKg:     data.empty_kg,
      netLoadKg:   data.net_load_kg,
    })
  }

  return (
    <>
      <style>{`
        /* ── Dashboard layout ── */
        .op-dash-root {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }

        /* LEFT panel — pending (60%) */
        .op-dash-left {
          flex: 0 0 60%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #E2E8F0;
          overflow: hidden;
        }

        /* RIGHT panel — vehicles (40%) */
        .op-dash-right {
          flex: 0 0 40%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #F8F9FA;
        }

        /* LEFT scroll area */
        .op-dash-left-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        /* ── Tablet (≤ 860px): shrink proportions ── */
        @media (max-width: 860px) {
          .op-dash-left  { flex: 0 0 55%; }
          .op-dash-right { flex: 0 0 45%; }
        }

        /* ── Mobile (≤ 640px): stack vertically ── */
        @media (max-width: 640px) {
          .op-dash-root {
            flex-direction: column;
            overflow-y: auto;
            overflow-x: hidden;
          }

          /* Left takes natural height, no fixed flex basis */
          .op-dash-left {
            flex: none;
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #E2E8F0;
            overflow: visible;
          }

          /* Scroll body expands fully — no inner scroll on mobile */
          .op-dash-left-body {
            flex: none;
            overflow: visible;
            padding: 16px;
          }

          /* Right panel takes natural height below */
          .op-dash-right {
            flex: none;
            width: 100%;
            min-height: 300px;
          }
        }

        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>

      <SuccessFlash />

      <div className="op-dash-root">

        {/* ── LEFT — Pending confirmation ── */}
        <div className="op-dash-left">

          {/* Section header */}
          <div style={{
            padding: '20px 24px 0',
            borderBottom: '1px solid #E2E8F0',
            background: 'white',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', paddingBottom: 16,
            }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                  color: '#94A3B8', marginBottom: 4,
                }}>
                  PENDING CONFIRMATION
                </div>
                {enrichedPending && (
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Vehicle detected · waiting for your action
                  </div>
                )}
              </div>
              {pending.length > 1 && (
                <div style={{
                  background: '#FEF3C7', border: '1px solid #FDE68A',
                  borderRadius: 20, padding: '2px 10px',
                  fontSize: 12, fontWeight: 600, color: '#92400E',
                }}>
                  {pending.length} in queue
                </div>
              )}
            </div>
          </div>

          {/* Pending content */}
          <div className="op-dash-left-body">
            {pl ? (
              <SkeletonCard />
            ) : enrichedPending ? (
              <PendingCard
                key={enrichedPending.id}
                pending={enrichedPending}
                onSuccess={handleSuccess}
              />
            ) : (
              <PendingIdle />
            )}

            {/* Queue */}
            {pending.length > 1 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.08em', color: '#94A3B8',
                }}>
                  QUEUE
                </div>
                {pending.slice(1).map(p => (
                  <button key={p.id} onClick={() => setActivePending(p)}
                    style={{
                      width: '100%', padding: '12px 16px', background: 'white',
                      border: '1px solid #E2E8F0', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(37,99,235,0.06)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'
                      ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                    }}>
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontSize: 14,
                      fontWeight: 500, color: '#0F172A',
                    }}>
                      {p.weight_ocr ? `${parseInt(p.weight_ocr).toLocaleString()} KG` : '— KG'}
                    </span>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>tap to review →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — Vehicles on site ── */}
        <div className="op-dash-right">
          <VehicleOnSiteList vehicles={vehicles} loading={vl} />
        </div>
      </div>

      {/* Modals */}
      {showReturnModal && enrichedPending && (
        <ReturnSelectionModal
          pendingId={enrichedPending.id}
          pendingPlate={enrichedPending.plate_ocr || ''}
          weightOcr={enrichedPending.weight_ocr || ''}
          weightConf={enrichedPending.weight_conf || 0}
          outdoorSnapshot={enrichedPending.outdoor_snapshot_url}
          indoorSnapshot={enrichedPending.indoor_snapshot_url}
          onSuccess={handleSuccess}
        />
      )}

      {showDismissModal && enrichedPending && (
        <DismissModal
          pendingId={enrichedPending.id}
          weightOcr={enrichedPending.weight_ocr || ''}
          onDismissed={() => setShowDismissModal(false)}
        />
      )}
    </>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'white', border: '1px solid #E2E8F0',
      borderRadius: 12, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {[80, 120, 200, 56].map((h, i) => (
        <div key={i} style={{
          height: h, borderRadius: 8, background: '#F1F5F9',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}