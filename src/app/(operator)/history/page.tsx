// src/app/(operator)/history/page.tsx
'use client'
import { useState } from 'react'
import { SnapshotLightbox } from '@/components/operator/SnapshotLightbox'
import { EditModal }        from '@/components/operator/EditModal'
import {
  useHistory,
  type DateFilter,
  type StatusFilter,
  type HistoryRow,
  type AuditEntry,
  type Weighing,
  type DismissedItem,
} from '@/lib/hooks/useHistory'

// ── Helpers ───────────────────────────────────────────────────────────────────
function isSameDay(row: HistoryRow) {
  const d = row._kind === 'weighing'
    ? new Date((row as Weighing).entry_at)
    : new Date((row as DismissedItem).triggered_at)
  return d.toDateString() === new Date().toDateString()
}

function getBadge(status: string) {
  const MAP: Record<string, { bg: string; color: string; label: string }> = {
    waiting:   { bg: '#EFF6FF', color: '#1D4ED8', label: 'ENTRY' },
    complete:  { bg: '#F0FDF4', color: '#15803D', label: 'RETURN' },
    dismissed: { bg: '#FEF2F2', color: '#DC2626', label: 'DISMISSED' },
    flagged:   { bg: '#FEF3C7', color: '#92400E', label: 'FLAGGED' },
    cancelled: { bg: '#F1F5F9', color: '#64748B', label: 'CANCELLED' },
  }
  return MAP[status] ?? { bg: '#F1F5F9', color: '#64748B', label: status.toUpperCase() }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Btn({ label, active, onClick, dark = false }: {
  label: string; active: boolean; onClick: () => void; dark?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      height: 34, padding: '0 16px',
      background: active ? (dark ? '#0F172A' : '#2563EB') : 'white',
      color: active ? 'white' : '#64748B',
      border: `1.5px solid ${active ? (dark ? '#0F172A' : '#2563EB') : '#E2E8F0'}`,
      borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
      cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', transition: 'all 0.12s',
    }}>{label}</button>
  )
}

function DataField({ label, val, mono, green, edited, ocr }: {
  label: string; val: string; mono?: boolean; green?: boolean
  edited?: boolean; ocr?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                       color: '#94A3B8' }}>{label}</span>
        {edited && (
          <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF3C7',
                         color: '#92400E', padding: '1px 5px', borderRadius: 3,
                         letterSpacing: '0.04em' }}>EDITED</span>
        )}
      </div>
      <div style={{
        fontSize: 14, fontWeight: green ? 700 : 500,
        color: green ? '#059669' : '#0F172A',
        fontFamily: mono ? 'DM Mono,monospace' : 'DM Sans,sans-serif',
      }}>{val}</div>
      {edited && ocr && (
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2,
                      fontFamily: 'DM Mono,monospace' }}>
          OCR: <span style={{ textDecoration: 'line-through' }}>{ocr}</span>
        </div>
      )}
    </div>
  )
}

function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (!entries?.length) return null
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                    color: '#94A3B8', marginBottom: 10 }}>AUDIT TRAIL</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(a => (
          <div key={a.id} style={{ background: '#F8F9FA', borderRadius: 6,
                                   padding: '8px 10px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: a.was_edited ? 4 : 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B',
                             textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {a.field}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                color: a.was_edited ? '#D97706' : '#10B981',
                background: a.was_edited ? '#FEF3C7' : '#F0FDF4',
                padding: '1px 6px', borderRadius: 4,
              }}>
                {a.was_edited ? 'EDITED' : 'CONFIRMED'}
              </span>
            </div>
            {a.was_edited && (
              <div style={{ fontSize: 11, color: '#64748B',
                            display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: 'DM Mono,monospace',
                               textDecoration: 'line-through', color: '#94A3B8' }}>
                  {a.ocr_value || '—'}
                </span>
                <span style={{ color: '#CBD5E1' }}>→</span>
                <span style={{ fontFamily: 'DM Mono,monospace',
                               color: '#0F172A', fontWeight: 600 }}>
                  {a.operator_value || '—'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailPanel({
  selected, auditMap, onLightbox, onEdited,
}: {
  selected:   HistoryRow
  auditMap:   Record<string, AuditEntry[]>
  onLightbox: (outdoor: string | null, indoor: string | null) => void
  onEdited:   () => void
}) {
  const [showEdit, setShowEdit] = useState(false)
  const canEdit = isSameDay(selected)

  const w = selected._kind === 'weighing'  ? selected as Weighing      : null
  const d = selected._kind === 'dismissed' ? selected as DismissedItem : null

  const entryOutdoor = w?.entry_snapshot_url         ?? d?.outdoor_snapshot_url ?? null
  const entryIndoor  = w?.entry_indoor_snapshot_url  ?? d?.indoor_snapshot_url  ?? null
  const exitOutdoor  = w?.return_snapshot_url        ?? null
  const exitIndoor   = w?.return_indoor_snapshot_url ?? null

  const dismissReason = d?.dismiss_reason ?? null

  const snapshotGroups = [
    {
      label:   'ENTRY',
      outdoor: entryOutdoor,
      indoor:  entryIndoor,
    },
    ...(exitOutdoor || exitIndoor ? [{
      label:   'EXIT',
      outdoor: exitOutdoor,
      indoor:  exitIndoor,
    }] : []),
  ]

  return (
    <>
      {showEdit && (
        <EditModal
          row={selected}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); onEdited() }}
        />
      )}

      <div style={{ flex:1, overflowY:'auto', padding:20,
                    display:'flex', flexDirection:'column', gap:16 }}>

        {/* Edit button — same-day only */}
        {canEdit ? (
          <button onClick={() => setShowEdit(true)}
            style={{
              width:'100%', height:40, background:'white',
              border:'1.5px solid #2563EB', borderRadius:8,
              color:'#2563EB', fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'DM Sans, sans-serif',
              letterSpacing:'0.04em',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            EDIT THIS RECORD
          </button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:8,
                        background:'#F8F9FA', borderRadius:8,
                        padding:'10px 14px', border:'1px solid #E2E8F0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize:12, color:'#94A3B8' }}>
              Past-day records are read-only
            </span>
          </div>
        )}

        {/* Snapshots */}
        {snapshotGroups.some(g => g.outdoor || g.indoor) ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {snapshotGroups.map(group => (
              (group.outdoor || group.indoor) && (
                <div key={group.label}>
                  {/* Group header */}
                  <div style={{
                    fontSize:10, fontWeight:700, letterSpacing:'0.1em',
                    color: group.label === 'EXIT' ? '#059669' : '#2563EB',
                    marginBottom:8,
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                    <div style={{
                      width:6, height:6, borderRadius:3,
                      background: group.label === 'EXIT' ? '#059669' : '#2563EB',
                    }} />
                    {group.label}
                  </div>

                  {/* Two-column grid for outdoor + indoor */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      { url: group.outdoor, label: 'PLATE CAMERA'  },
                      { url: group.indoor,  label: 'SCALE DISPLAY' },
                    ].map(({ url, label }) => (
                      <div key={label}>
                        <div style={{ fontSize:10, fontWeight:600,
                                      letterSpacing:'0.08em', color:'#94A3B8',
                                      marginBottom:4 }}>{label}</div>
                        {url ? (
                          <button
                            onClick={() => onLightbox(group.outdoor, group.indoor)}
                            style={{ width:'100%', padding:0,
                                      border:'1px solid #E2E8F0', borderRadius:8,
                                      overflow:'hidden', cursor:'zoom-in',
                                      background:'#F8F9FA', display:'block' }}>
                            <img src={url} alt={label}
                              style={{ width:'100%', display:'block',
                                       aspectRatio:'16/9', objectFit:'cover' }} />
                          </button>
                        ) : (
                          <div style={{
                            aspectRatio:'16/9', borderRadius:8,
                            background:'#F8F9FA', border:'1px solid #E2E8F0',
                            display:'flex', alignItems:'center',
                            justifyContent:'center',
                            fontSize:11, color:'#CBD5E1',
                          }}>
                            No snapshot
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          <div style={{ background:'#F8F9FA', borderRadius:8, padding:'12px 14px',
                        fontSize:12, color:'#94A3B8', textAlign:'center' }}>
            No snapshots available
          </div>
        )}

        {/* Dismiss reason */}
        {dismissReason && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
                        borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#DC2626',
                          marginBottom:4, letterSpacing:'0.06em' }}>
              DISMISS REASON
            </div>
            <div style={{ fontSize:13, color:'#991B1B' }}>{dismissReason}</div>
          </div>
        )}

        {/* Data fields */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {w ? (
            <>
              <DataField label="TOKEN" val={w.token_number} mono />
              <DataField label="PLATE" val={w.plate_number || '—'} mono
                edited={w.plate_edited_by_operator}
                ocr={w.plate_ocr_raw || undefined} />
              <DataField label="LOADED WEIGHT"
                val={w.loaded_weight ? `${w.loaded_weight.toLocaleString()} kg` : '—'}
                edited={w.loaded_weight_edited}
                ocr={w.loaded_weight_ocr_raw
                  ? `${parseInt(w.loaded_weight_ocr_raw).toLocaleString()} kg` : undefined} />
              <DataField label="EMPTY WEIGHT"
                val={w.empty_weight ? `${w.empty_weight.toLocaleString()} kg` : '—'}
                edited={w.empty_weight_edited}
                ocr={w.empty_weight_ocr_raw
                  ? `${parseInt(w.empty_weight_ocr_raw).toLocaleString()} kg` : undefined} />
              {w.net_load != null && (
                <DataField label="NET LOAD"
                  val={`${w.net_load.toLocaleString()} kg`} green />
              )}
              <DataField label="ENTRY TIME"
                val={new Date(w.entry_at).toLocaleString('en-GB')} mono />
              {w.return_at && (
                <DataField label="RETURN TIME"
                  val={new Date(w.return_at).toLocaleString('en-GB')} mono />
              )}
              {w.flag_reason && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA',
                              borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#DC2626',
                                marginBottom:4 }}>FLAG REASON</div>
                  <div style={{ fontSize:12, color:'#991B1B' }}>{w.flag_reason}</div>
                </div>
              )}
              {(w.edit_count ?? 0) > 0 && (
                <div style={{ fontSize:11, color:'#94A3B8' }}>
                  Edited {w.edit_count} time(s)
                  {w.last_edited_at && (
                    <> · last at {new Date(w.last_edited_at).toLocaleTimeString('en-GB')}</>
                  )}
                </div>
              )}
              <AuditTrail entries={auditMap[w.id] || []} />
            </>
          ) : d ? (
            <>
              <DataField label="WEIGHT OCR"
                val={d.weight_ocr
                  ? `${parseInt(d.weight_ocr).toLocaleString()} kg` : '—'} />
              <DataField label="DETECTED AT"
                val={new Date(d.triggered_at).toLocaleString('en-GB')} mono />
              <DataField label="STATUS" val="DISMISSED" />
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [dateFilter,   setDateFilter] = useState<DateFilter>('today')
  const [statusFilter, setStatus]     = useState<StatusFilter>('all')
  const [customFrom,   setCustomFrom] = useState('')
  const [customTo,     setCustomTo]   = useState('')
  const [selected,     setSelected]   = useState<HistoryRow | null>(null)
  const [lightbox,     setLightbox]   = useState<{
    outdoor: string | null; indoor: string | null } | null>(null)

  const { rows, auditMap, loading, error, refetch } = useHistory({
    dateFilter, statusFilter, customFrom, customTo,
  })

  return (
    <>
      {lightbox && (
        <SnapshotLightbox
          url={lightbox.outdoor || lightbox.indoor || ''}
          outdoor={lightbox.outdoor}
          indoor={lightbox.indoor}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0',
                    padding: '0 24px', display: 'flex', flexShrink: 0 }}>
        {[{ label: 'PENDING', href: '/dashboard' },
          { label: 'HISTORY', href: '/history' }].map(tab => (
          <a key={tab.label} href={tab.href} style={{
            padding: '16px 20px', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.08em', textDecoration: 'none',
            color: tab.href === '/history' ? '#2563EB' : '#94A3B8',
            borderBottom: tab.href === '/history'
              ? '2px solid #2563EB' : '2px solid transparent',
            marginBottom: -1,
          }}>{tab.label}</a>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT — list ───────────────────────────────── */}
        <div style={{ flex: '0 0 calc(100% - 340px)', display: 'flex',
                      flexDirection: 'column', overflow: 'hidden',
                      borderRight: '1px solid #E2E8F0' }}>

          {/* Filters */}
          <div style={{ padding: '14px 24px', background: 'white',
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn label="TODAY"      active={dateFilter === 'today'}  onClick={() => setDateFilter('today')} />
              <Btn label="THIS WEEK"  active={dateFilter === 'week'}   onClick={() => setDateFilter('week')} />
              <Btn label="THIS MONTH" active={dateFilter === 'month'}  onClick={() => setDateFilter('month')} />
              <Btn label="CUSTOM"     active={dateFilter === 'custom'} onClick={() => setDateFilter('custom')} />
              {dateFilter === 'custom' && (
                <>
                  <input type="date" value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    style={{ height: 34, padding: '0 10px', border: '1.5px solid #E2E8F0',
                              borderRadius: 6, fontSize: 13, outline: 'none',
                              fontFamily: 'DM Sans,sans-serif', color: '#0F172A' }} />
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>to</span>
                  <input type="date" value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    style={{ height: 34, padding: '0 10px', border: '1.5px solid #E2E8F0',
                              borderRadius: 6, fontSize: 13, outline: 'none',
                              fontFamily: 'DM Sans,sans-serif', color: '#0F172A' }} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn label="ALL"       active={statusFilter === 'all'}       onClick={() => setStatus('all')} dark />
              <Btn label="ENTRY"     active={statusFilter === 'waiting'}   onClick={() => setStatus('waiting')} />
              <Btn label="RETURN"    active={statusFilter === 'complete'}  onClick={() => setStatus('complete')} />
              <Btn label="DISMISSED" active={statusFilter === 'dismissed'} onClick={() => setStatus('dismissed')} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ margin: '12px 24px', background: '#FEF2F2',
                          border: '1px solid #FECACA', borderRadius: 8,
                          padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>
              {error}
            </div>
          )}

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px',
                        display: 'flex', flexDirection: 'column', gap: 10 }}>

            {loading && [1, 2, 3].map(i => (
              <div key={i} style={{ height: 76, borderRadius: 10, background: '#F1F5F9',
                                    animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}

            {!loading && rows.length === 0 && (
              <div style={{ height: 300, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            color: '#94A3B8', gap: 12 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                <span style={{ fontSize: 14 }}>No records found</span>
                <button
                  onClick={() => { setDateFilter('week'); setStatus('all') }}
                  style={{ fontSize: 13, color: '#2563EB', background: 'none',
                            border: 'none', cursor: 'pointer' }}>
                  Show this week
                </button>
              </div>
            )}

            {rows.map(row => {
              const isW      = row._kind === 'weighing'
              const w        = isW ? row as Weighing : null
              const dm       = !isW ? row as DismissedItem : null
              const time     = new Date(isW ? w!.entry_at : dm!.triggered_at)
                .toLocaleTimeString('en-GB', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const token    = w ? w.token_number : '—'
              const plate    = w ? (w.plate_number || '—') : '—'
              const loaded   = w ? w.loaded_weight
                : parseFloat(dm?.weight_ocr || '0') || null
              const net      = w ? w.net_load : null
              const badge    = getBadge(row.status)
              const isActive = selected?.id === row.id
              const hasEdits = w && (
                w.plate_edited_by_operator ||
                w.loaded_weight_edited ||
                w.empty_weight_edited
              )
              const editedToday = isSameDay(row)

              return (
                <button key={row.id} onClick={() => setSelected(row)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: isActive ? '#F0F7FF' : 'white',
                    border: `1.5px solid ${isActive ? '#2563EB' : '#E2E8F0'}`,
                    borderRadius: 10, padding: '16px 20px',
                    display: 'grid', alignItems: 'center',
                    gridTemplateColumns: '80px 1fr 110px 130px 130px 110px 28px',
                    gap: 12, transition: 'all 0.12s',
                    boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.07)' : 'none',
                  }}>
                  {/* Token */}
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 12,
                                 color: '#64748B', fontWeight: 500 }}>{token}</span>
                  {/* Plate + edit dot */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 16,
                                   fontWeight: 700, color: '#0F172A' }}>{plate}</span>
                    {hasEdits && (
                      <span title="Values edited by operator"
                        style={{ width: 7, height: 7, borderRadius: 4,
                                  background: '#D97706', flexShrink: 0,
                                  display: 'inline-block' }} />
                    )}
                    {editedToday && (
                      <span title="Editable today"
                        style={{ width: 7, height: 7, borderRadius: 4,
                                  background: '#2563EB', flexShrink: 0,
                                  display: 'inline-block', opacity: 0.4 }} />
                    )}
                  </span>
                  {/* Badge */}
                  <span style={{ background: badge.bg, color: badge.color,
                                 borderRadius: 6, padding: '3px 10px',
                                 fontSize: 11, fontWeight: 700,
                                 letterSpacing: '0.06em', textAlign: 'center' }}>
                    {badge.label}
                  </span>
                  {/* Loaded */}
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 14,
                                 color: '#0F172A', fontWeight: 500 }}>
                    {loaded ? `${loaded.toLocaleString()} kg` : '—'}
                  </span>
                  {/* Net */}
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 14,
                                 color: net ? '#059669' : '#94A3B8',
                                 fontWeight: net ? 700 : 400 }}>
                    {net ? `${net.toLocaleString()} kg` : '—'}
                  </span>
                  {/* Time */}
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 13,
                                 color: '#64748B' }}>{time}</span>
                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={isActive ? '#2563EB' : '#CBD5E1'}
                    strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT — detail panel ──────────────────────── */}
        <div style={{ width: 340, flexShrink: 0, background: 'white',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                          color: '#94A3B8' }}>DETAILS</div>
          </div>

          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#CBD5E1',
                          fontSize: 13, textAlign: 'center',
                          padding: 24, lineHeight: 1.6 }}>
              Select a record<br/>to view details
            </div>
          ) : (
            <DetailPanel
              selected={selected}
              auditMap={auditMap}
              onLightbox={(outdoor, indoor) => setLightbox({ outdoor, indoor })}
              onEdited={() => {
                setSelected(null)
                refetch()
              }}
            />
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  )
}