// src/app/(admin)/overview/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { SnapshotLightbox } from '@/components/operator/SnapshotLightbox'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────
interface StatCard {
  label: string; value: number; delta: number; unit?: string
}
interface LiveVehicle {
  id: string; token_number: string; plate_number: string | null
  loaded_weight: number | null; entry_at: string
  entry_operator_id: string | null
}
interface RecentActivity {
  id: string; plate_number: string | null; token_number: string
  action: 'ENTRY' | 'RETURN' | 'DISMISS'; operator_name: string | null
  time: string; status: string
}
interface Alert {
  id: string; camera_id: string; detector: string
  event_type: string; severity: string; confidence: number
  message: string; snapshot_url: string | null
  resolved_snapshot_url: string | null
  is_resolved: boolean; created_at: string
  resolved_at: string | null
  extra: Record<string, any> | null
}

// ── Timezone helpers ──────────────────────────────────────────
const TZ = 'Asia/Karachi'

/**
 * Returns the UTC ISO string for midnight of today (or today + offsetDays)
 * in the Asia/Karachi timezone (UTC+5).
 *
 * Strategy: get today's date string in PKT via en-CA locale (gives YYYY-MM-DD),
 * then construct that day's 00:00:00 as UTC by subtracting 5 hours.
 */
function karachiMidnight(offsetDays = 0): string {
  const pkDateStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // "YYYY-MM-DD"
  const [y, m, d] = pkDateStr.split('-').map(Number)
  // midnight PKT = (midnight PKT date) - 5h in UTC
  const utcMs = Date.UTC(y, m - 1, d + offsetDays, 0, 0, 0) - 5 * 60 * 60 * 1000
  return new Date(utcMs).toISOString()
}

/** Format any ISO string for display in Asia/Karachi timezone */
function pkTime(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, ...opts })
}

/** HH:mm only */
function pkTimeShort(iso: string): string {
  return pkTime(iso, { hour: '2-digit', minute: '2-digit' })
}

/** "Friday, 2 May" style */
function pkDateLong(iso: string): string {
  return pkTime(iso, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Full date + time: "02/05/2026, 06:58:23" */
function pkDateTimeFull(iso: string): string {
  return pkTime(iso, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Other helpers ─────────────────────────────────────────────
function siteTime(entryAt: string) {
  const mins = Math.floor(
    (Date.now() - new Date(entryAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
function siteColor(entryAt: string) {
  const hrs = (Date.now() - new Date(entryAt).getTime()) / 3600000
  if (hrs > 8) return '#DC2626'
  if (hrs > 4) return '#D97706'
  return '#64748B'
}
function detectorLabel(d: string) {
  return ({
    pulp_overflow:    'PULP OVERFLOW',
    paper_cut:        'PAPER CUT',
    perimeter_breach: 'PERIMETER',
    low_visibility:   'LOW VISIBILITY',
    weighbridge:      'WEIGHBRIDGE',
  } as Record<string, string>)[d] ?? d.toUpperCase().replace(/_/g, ' ')
}
function severityColor(s: string) {
  return s === 'critical' ? '#DC2626'
    : s === 'warning' ? '#D97706'
    : '#2563EB'
}
function severityBg(s: string) {
  return s === 'critical' ? '#FEF2F2'
    : s === 'warning' ? '#FFFBEB'
    : '#EFF6FF'
}
function cameraLabel(c: string) {
  return ({
    'CAM-SCALE-OUT': 'Scale Outdoor',
    'CAM-SCALE-IN':  'Scale Indoor',
    'CAM-PULP-01':   'Pulp Tank',
    'CAM-PAPER-01':  'Paper Machine',
  } as Record<string, string>)[c] ?? c
}

// ── Stat card ─────────────────────────────────────────────────
function StatCardUI({ label, value, delta }: StatCard) {
  const up = delta >= 0
  return (
    <div style={{
      background: 'white', borderRadius: 10,
      border: '1px solid #E2E8F0', padding: '20px 24px',
      flex: 1,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                    color: '#94A3B8', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end',
                    justifyContent: 'space-between' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#0F172A',
                      fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>
          {value}
        </div>
        {delta !== 0 && (
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: up ? '#059669' : '#DC2626',
            display: 'flex', alignItems: 'center', gap: 2,
            marginBottom: 2,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}/>
            </svg>
            {up ? '+' : ''}{delta}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats,      setStats]      = useState<StatCard[]>([])
  const [vehicles,   setVehicles]   = useState<LiveVehicle[]>([])
  const [activity,   setActivity]   = useState<RecentActivity[]>([])
  const [alerts,     setAlerts]     = useState<Alert[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lightbox,   setLightbox]   = useState<{ outdoor: string | null; indoor: string | null } | null>(null)
  const [alertModal, setAlertModal] = useState<Alert | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = getClient()

    // ── Karachi-aware day boundaries ──────────────────────────
    const todayISO = karachiMidnight(0)   // midnight today PKT expressed in UTC
    const ydayISO  = karachiMidnight(-1)  // midnight yesterday PKT expressed in UTC

    // ── Today's weighing stats ────────────────────────────────
    const { data: todayW } = await supabase
      .from('weighings')
      .select('id, status, entry_at')
      .gte('entry_at', todayISO)

    const total     = todayW?.length ?? 0
    const onSite    = todayW?.filter(w => w.status === 'waiting').length   ?? 0
    const completed = todayW?.filter(w => w.status === 'complete').length  ?? 0
    const flagged   = todayW?.filter(w => w.status === 'flagged').length   ?? 0

    // ── Yesterday for delta ───────────────────────────────────
    const { data: yestW } = await supabase
      .from('weighings')
      .select('id, status')
      .gte('entry_at', ydayISO)
      .lt('entry_at', todayISO)

    const yTotal   = yestW?.length ?? 0
    const ySite    = yestW?.filter(w => w.status === 'waiting').length  ?? 0
    const yComp    = yestW?.filter(w => w.status === 'complete').length ?? 0
    const yFlag    = yestW?.filter(w => w.status === 'flagged').length  ?? 0

    // ── Today's alerts ────────────────────────────────────────
    const { data: todayAlerts } = await supabase
      .from('alerts')
      .select('id, resolved_at')
      .gte('created_at', todayISO)
    const alertCount  = todayAlerts?.length ?? 0

    const { data: yestAlerts } = await supabase
      .from('alerts')
      .select('id')
      .gte('created_at', ydayISO)
      .lt('created_at', todayISO)
    const yAlertCount = yestAlerts?.length ?? 0

    setStats([
      { label: "TODAY'S VEHICLES", value: total,      delta: total - yTotal },
      { label: 'ON SITE NOW',       value: onSite,     delta: onSite - ySite },
      { label: 'COMPLETED',         value: completed,  delta: completed - yComp },
      { label: 'FLAGGED',           value: flagged,    delta: flagged - yFlag },
      { label: "TODAY'S ALERTS",    value: alertCount, delta: alertCount - yAlertCount },
    ])

    // ── Live vehicles ─────────────────────────────────────────
    const { data: liveV } = await supabase
      .from('weighings')
      .select('id, token_number, plate_number, loaded_weight, entry_at, entry_operator_id')
      .eq('status', 'waiting')
      .order('entry_at', { ascending: false })
      .limit(10)
    setVehicles(liveV || [])

    // ── Recent activity ───────────────────────────────────────
    const { data: recentW } = await supabase
      .from('weighings')
      .select(`id, plate_number, token_number, status, entry_at, return_at,
               entry_operator_id, return_operator_id`)
      .gte('entry_at', todayISO)
      .order('entry_at', { ascending: false })
      .limit(15)

    const opIds = [...new Set([
      ...(recentW || []).map(w => w.entry_operator_id),
      ...(recentW || []).map(w => w.return_operator_id),
    ].filter(Boolean))]

    let opNames: Record<string, string> = {}
    if (opIds.length > 0) {
      const { data: ops } = await supabase
        .from('operators')
        .select('id, name')
        .in('id', opIds)
      ;(ops || []).forEach((o: any) => { opNames[o.id] = o.name })
    }

    const acts: RecentActivity[] = []
    ;(recentW || []).forEach((w: any) => {
      if (w.return_at) {
        acts.push({
          id: w.id + '_r', plate_number: w.plate_number,
          token_number: w.token_number, action: 'RETURN',
          operator_name: opNames[w.return_operator_id] || null,
          time: w.return_at, status: w.status,
        })
      }
      acts.push({
        id: w.id + '_e', plate_number: w.plate_number,
        token_number: w.token_number, action: 'ENTRY',
        operator_name: opNames[w.entry_operator_id] || null,
        time: w.entry_at, status: w.status,
      })
    })
    acts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setActivity(acts.slice(0, 12))

    // ── Recent alerts ─────────────────────────────────────────
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
    setAlerts(recentAlerts || [])

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const supabase = getClient()
    const ch = supabase.channel('overview_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weighings' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },    fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchAll])

  // Page header date rendered in Karachi time
  const todayLabel = pkDateLong(new Date().toISOString())

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

      {alertModal && (
        <AlertDetailModal
          alert={alertModal}
          onClose={() => setAlertModal(null)}
          onLightbox={(url) => setLightbox({ outdoor: url, indoor: null })}
          onResolved={fetchAll}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', background: '#F8F9FA',
                    padding: '32px 32px 48px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A',
                        fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Overview
          </h1>
          <div style={{ fontSize: 13, color: '#64748B', background: 'white',
                        border: '1px solid #E2E8F0', borderRadius: 8,
                        padding: '8px 14px', fontFamily: 'DM Sans, sans-serif' }}>
            {todayLabel}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          {loading
            ? [1,2,3,4,5].map(i => (
                <div key={i} style={{ flex: 1, height: 96, borderRadius: 10,
                  background: '#F1F5F9', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))
            : stats.map(s => <StatCardUI key={s.label} {...s} />)
          }
        </div>

        {/* Main 3-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: 20, marginBottom: 24 }}>

          {/* ── Live vehicles ─────────────────────────────── */}
          <div style={{ background: 'white', borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                            color: '#94A3B8' }}>
                LIVE — VEHICLES ON SITE
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white',
                            background: '#2563EB', borderRadius: 10,
                            padding: '2px 10px',
                            fontFamily: 'DM Mono, monospace' }}>
                {vehicles.length}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
                          display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && [1,2,3].map(i => (
                <div key={i} style={{ height: 64, borderRadius: 8, background: '#F1F5F9',
                  animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
              {!loading && vehicles.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center',
                              color: '#94A3B8', fontSize: 13 }}>
                  No vehicles on site
                </div>
              )}
              {vehicles.map(v => (
                <div key={v.id} style={{
                  background: '#F8F9FA', borderRadius: 8,
                  border: '1px solid #E2E8F0', padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'DM Mono, monospace', fontSize: 11,
                        background: '#EFF6FF', color: '#1D4ED8',
                        padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                      }}>{v.token_number}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace',
                                     fontSize: 15, fontWeight: 700,
                                     color: '#0F172A' }}>
                        {v.plate_number || '—'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13,
                                   color: '#0F172A', fontWeight: 500 }}>
                      {v.loaded_weight
                        ? `${v.loaded_weight.toLocaleString()} kg` : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: siteColor(v.entry_at),
                                fontFamily: 'DM Mono, monospace' }}>
                    On site: {siteTime(v.entry_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent alerts ─────────────────────────────── */}
          <div style={{ background: 'white', borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                            color: '#94A3B8' }}>
                RECENT ALERTS
              </div>
              <a href="/alerts" style={{ fontSize: 12, color: '#2563EB',
                                         textDecoration: 'none', fontWeight: 500 }}>
                View all →
              </a>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
                          display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && [1,2,3].map(i => (
                <div key={i} style={{ height: 80, borderRadius: 8, background: '#F1F5F9',
                  animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
              {!loading && alerts.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center',
                              color: '#94A3B8', fontSize: 13 }}>
                  No alerts yet
                </div>
              )}
              {alerts.map(a => (
                <button key={a.id} onClick={() => setAlertModal(a)}
                  style={{
                    background: severityBg(a.severity),
                    borderRadius: 8, padding: '12px 14px',
                    border: `1px solid ${severityColor(a.severity)}30`,
                    borderLeft: `3px solid ${severityColor(a.severity)}`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: severityColor(a.severity),
                        letterSpacing: '0.06em',
                      }}>
                        {detectorLabel(a.detector)}
                      </span>
                      {a.is_resolved && (
                        <span style={{ fontSize: 9, fontWeight: 700,
                                       background: '#F0FDF4', color: '#059669',
                                       padding: '1px 5px', borderRadius: 3,
                                       letterSpacing: '0.04em' }}>
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#94A3B8',
                                   fontFamily: 'DM Mono, monospace' }}>
                      {pkTimeShort(a.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#0F172A',
                                lineHeight: 1.4, marginBottom: 4 }}>
                    {a.message}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    {cameraLabel(a.camera_id)}
                    {a.extra?.duration_sec
                      ? ` · ${a.extra.duration_sec}s` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  )
}

// ── Alert detail modal ────────────────────────────────────────
function AlertDetailModal({
  alert, onClose, onLightbox, onResolved,
}: {
  alert:       Alert
  onClose:     () => void
  onLightbox:  (url: string) => void
  onResolved:  () => void
}) {
  const [resolving, setResolving] = useState(false)

  const markResolved = async () => {
    setResolving(true)
    const supabase = getClient()
    await supabase.from('alerts').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', alert.id)
    setResolving(false)
    onResolved()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center',
                      borderLeft: `4px solid ${severityColor(alert.severity)}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              {detectorLabel(alert.detector)}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {cameraLabel(alert.camera_id)} ·{' '}
              {pkDateTimeFull(alert.created_at)}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none',
                      cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24,
                      display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Snapshot */}
          {alert.snapshot_url && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                            color: '#94A3B8', marginBottom: 6 }}>
                START SNAPSHOT
              </div>
              <button onClick={() => onLightbox(alert.snapshot_url!)}
                style={{ width: '100%', padding: 0, border: '1px solid #E2E8F0',
                          borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in',
                          background: 'none', display: 'block' }}>
                <img src={alert.snapshot_url} alt="Alert snapshot"
                  style={{ width: '100%', display: 'block',
                           aspectRatio: '16/9', objectFit: 'cover' }} />
              </button>
            </div>
          )}

          {alert.resolved_snapshot_url && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                            color: '#94A3B8', marginBottom: 6 }}>
                RESOLVED SNAPSHOT
              </div>
              <button onClick={() => onLightbox(alert.resolved_snapshot_url!)}
                style={{ width: '100%', padding: 0, border: '1px solid #E2E8F0',
                          borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in',
                          background: 'none', display: 'block' }}>
                <img src={alert.resolved_snapshot_url} alt="Resolved snapshot"
                  style={{ width: '100%', display: 'block',
                           aspectRatio: '16/9', objectFit: 'cover' }} />
              </button>
            </div>
          )}

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="MESSAGE"    val={alert.message} />
            <Row label="SEVERITY"   val={alert.severity.toUpperCase()}
              color={severityColor(alert.severity)} />
            <Row label="CONFIDENCE" val={`${(alert.confidence * 100).toFixed(0)}%`} mono />
            <Row label="TRIGGERED"  val={pkDateTimeFull(alert.created_at)} mono />
            {alert.resolved_at && (
              <Row label="RESOLVED"  val={pkDateTimeFull(alert.resolved_at)} mono />
            )}
            {alert.extra?.duration_sec && (
              <Row label="DURATION" val={`${alert.extra.duration_sec}s`} mono />
            )}
            {alert.extra?.triggered_pkt && (
              <Row label="PKT TIME" val={alert.extra.triggered_pkt} mono />
            )}
          </div>

          {/* Resolve button */}
          {!alert.is_resolved && (
            <button onClick={markResolved} disabled={resolving}
              style={{
                height: 44, background: '#059669', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                letterSpacing: '0.06em', cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}>
              {resolving ? 'MARKING...' : 'MARK RESOLVED'}
            </button>
          )}
          {alert.is_resolved && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0',
                          borderRadius: 8, padding: '10px 14px', fontSize: 13,
                          color: '#059669', textAlign: 'center', fontWeight: 600 }}>
              ✓ Alert resolved
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, val, mono, color }: {
  label: string; val: string; mono?: boolean; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', gap: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                     color: '#94A3B8', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: color || '#0F172A',
                     fontFamily: mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif',
                     textAlign: 'right' }}>{val}</span>
    </div>
  )
}