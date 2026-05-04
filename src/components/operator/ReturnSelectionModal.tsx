// src/components/operator/ReturnSelectionModal.tsx
// Matches screens 4, 5, 6 exactly
'use client'
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useOperatorStore } from '@/stores/operatorStore'
import { useConfirm } from '@/lib/hooks/useConfirm'
import { formatDistanceToNow } from 'date-fns'
import type { WaitingEntry } from '@/types'

interface ReturnSelectionModalProps {
  pendingId:       string
  pendingPlate:    string
  weightOcr:       string
  weightConf:      number
  outdoorSnapshot: string | null
  indoorSnapshot:  string | null
  onSuccess:       (data: any) => void
}

export function ReturnSelectionModal({
  pendingId, pendingPlate, weightOcr, weightConf,
  outdoorSnapshot, indoorSnapshot, onSuccess
}: ReturnSelectionModalProps) {
  const { closeReturnModal, selectedEntry, setSelectedEntry } = useOperatorStore()
  const { confirmReturn, getWaitingEntries, loading } = useConfirm()
  const [entries, setEntries] = useState<WaitingEntry[]>([])
  const [search, setSearch]   = useState('')
  const [weight, setWeight]   = useState('')

  const netPreview = selectedEntry && parseFloat(weight) > 0
    ? selectedEntry.loaded_weight - parseFloat(weight)
    : null

  useEffect(() => {
    getWaitingEntries(pendingPlate).then(setEntries)
  }, [])

  const filtered = entries.filter(e =>
    e.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    e.token_number.toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirm = async () => {
    if (!selectedEntry || !weight) return
    const result = await confirmReturn({
      p_pending_id:          pendingId,
      p_weighing_id:         selectedEntry.weighing_id,
      p_empty_weight_kg:     parseFloat(weight),
      p_weight_edited:       weight !== weightOcr,
      p_operator_id:         null,
      p_ocr_plate_back:      pendingPlate || '',
      p_ocr_plate_back_conf: weightConf,
      p_match_method:        'operator_selected',
      p_weight_ocr_raw:      weightOcr,
      p_weight_ocr_conf:     weightConf,
      p_return_snapshot:     outdoorSnapshot,
      p_indoor_snapshot:     indoorSnapshot,
    })
    if (result?.success) {
      closeReturnModal()
      onSuccess({ type: 'return', ...result })
    }
  }

  return (
    <>
      <style>{`
        /* Modal sheet sizing */
        .rsm-sheet {
          width: 100%;
          max-width: 500px;
          background: #141720;
          border: 1px solid #1e2130;
          border-radius: 12px;
          overflow: hidden;
        }

        /* Vehicle list max height */
        .rsm-list {
          max-height: 260px;
          overflow-y: auto;
        }

        /* Selected footer info row */
        .rsm-info-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        /* Net load font size */
        .rsm-net {
          font-family: monospace;
          font-size: 24px;
          font-weight: 700;
          color: #10b981;
        }

        /* ── Mobile (≤ 540px): full-width bottom sheet style ── */
        @media (max-width: 540px) {
          /* Overlay: align to bottom so modal slides up from bottom */
          .rsm-overlay {
            align-items: flex-end !important;
          }

          /* Sheet: full width, rounded only on top, no side margins */
          .rsm-sheet {
            max-width: 100%;
            border-radius: 16px 16px 0 0;
            border-left: none;
            border-right: none;
            border-bottom: none;
            /* Add safe area padding for home bar */
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          /* Shorter vehicle list on mobile to leave room for footer */
          .rsm-list { max-height: 180px; }

          /* Stack selected info vertically */
          .rsm-info-row {
            flex-direction: column;
            gap: 12px;
          }

          /* Smaller net load on mobile */
          .rsm-net { font-size: 20px; }
        }
      `}</style>

      <div
        className="rsm-overlay fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)' }}
      >
        <div className="rsm-sheet">

          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-base font-bold text-white tracking-wider">
              SELECT VEHICLE FOR RETURN
            </h2>
          </div>

          {/* Search */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]"
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="Search by plate or token..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm
                           text-[#94a3b8] outline-none
                           placeholder:text-[#4a5568] font-mono"
                style={{
                  background: '#0f1117',
                  border: '1px solid #1e2130',
                }}
              />
            </div>
          </div>

          {/* Vehicle list */}
          <div className="rsm-list px-6 pb-4 space-y-2">
            {filtered.length === 0 && (
              <p className="text-[#4a5568] text-sm text-center py-4">
                No waiting vehicles
              </p>
            )}
            {filtered.map(entry => {
              const isSelected = selectedEntry?.weighing_id === entry.weighing_id
              const hours = Math.abs(
                (Date.now() - new Date(entry.entry_at).getTime()) / 3600000
              )
              return (
                <button
                  key={entry.weighing_id}
                  onClick={() => setSelectedEntry(isSelected ? null : entry)}
                  className="w-full rounded-lg p-4 text-left transition-all
                             active:scale-[0.99] flex items-center gap-3"
                  style={{
                    background: isSelected ? '#0d2a1e' : '#0f1117',
                    border: `1px solid ${isSelected ? '#10b981' : '#1e2130'}`,
                  }}
                >
                  {/* Snapshot placeholder */}
                  <div
                    className="w-14 h-10 rounded shrink-0 flex items-center
                                 justify-center text-[10px] text-[#4a5568]"
                    style={{ background: '#1a1d27' }}
                  >
                    entry
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: '#1a2744',
                          color: '#60a5fa',
                          border: '1px solid #1e3a6e',
                        }}
                      >
                        {entry.token_number}
                      </span>
                      <span className="font-mono font-bold text-white truncate">
                        {entry.plate_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-[#94a3b8]">
                        {entry.loaded_weight?.toLocaleString()} KG
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: hours > 8 ? '#ef4444'
                                : hours > 4 ? '#f59e0b'
                                : '#4a5568'
                        }}
                      >
                        {formatDistanceToNow(new Date(entry.entry_at))} on site
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected vehicle footer */}
          {selectedEntry && (
            <div
              className="px-6 pb-6 pt-4 space-y-4"
              style={{ borderTop: '1px solid #1e2130' }}
            >
              {/* Selected info */}
              <div className="rsm-info-row">
                <div>
                  <p className="text-[11px] text-[#4a5568] uppercase tracking-wider mb-1">
                    Selected Vehicle
                  </p>
                  <p className="font-mono text-white font-semibold">
                    {selectedEntry.token_number} · {selectedEntry.plate_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[#4a5568] uppercase tracking-wider mb-1">
                    Loaded Weight
                  </p>
                  <p className="font-mono text-white font-semibold">
                    {selectedEntry.loaded_weight?.toLocaleString()} KG
                  </p>
                </div>
              </div>

              {/* Empty weight input */}
              <div>
                <p className="text-[11px] text-[#4a5568] uppercase tracking-wider mb-2">
                  Empty Weight (KG)
                </p>
                <input
                  value={weight}
                  onChange={e => setWeight(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter empty weight"
                  className="w-full rounded-lg px-4 py-3 font-mono text-lg
                             text-white outline-none placeholder:text-[#4a5568]"
                  style={{
                    background: '#0f1117',
                    border: `1px solid ${weight ? '#10b981' : '#1e2130'}`,
                  }}
                  autoFocus
                />
              </div>

              {/* Net load preview */}
              {netPreview !== null && netPreview > 0 && (
                <div
                  className="rounded-lg px-4 py-3"
                  style={{
                    background: '#0d2a1e',
                    border: '1px solid #10b98133',
                  }}
                >
                  <p className="text-[11px] text-[#4a5568] uppercase tracking-wider mb-1">
                    Net Load
                  </p>
                  <p className="rsm-net">
                    {netPreview.toLocaleString()} KG
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 items-center">
                <button
                  onClick={handleConfirm}
                  disabled={loading || !weight || parseFloat(weight) <= 0}
                  className="flex-1 rounded-lg font-bold tracking-wider
                             text-white active:scale-[0.98] transition-all
                             disabled:opacity-40"
                  style={{
                    background: netPreview && netPreview > 0 ? '#10b981' : '#1e2130',
                    height: '48px',
                    fontSize: '14px',
                  }}
                >
                  {loading ? 'SAVING...' : 'CONFIRM RETURN'}
                </button>
                <button
                  onClick={closeReturnModal}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: '#ef4444' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}