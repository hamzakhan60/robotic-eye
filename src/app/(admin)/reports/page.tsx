// app/(admin)/reports/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Period = 'daily' | 'weekly' | 'monthly'

interface WeighbridgeStats {
  totalTransactions: number
  totalNetWeight: number
  avgNetWeight: number
  avgTransactionMinutes: number
  peakHour: string
  editedCount: number
  statusBreakdown: { status: string; count: number }[]
  dailyTrend: { label: string; transactions: number; netWeight: number }[]
  topOperators: { name: string; count: number }[]
}

interface AlertStats {
  totalAlerts: number
  unresolvedCount: number
  resolvedCount: number
  avgResolutionMinutes: number
  bySeverity: { severity: string; count: number }[]
  byEventType: { event_type: string; count: number }[]
  byDetector: { detector: string; count: number }[]
  dailyTrend: { label: string; total: number; resolved: number }[]
  topCameras: { camera_id: string; count: number }[]
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getPeriodRange(period: Period): { from: Date; to: Date; buckets: string[]; bucketFn: (iso: string) => string } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)

  if (period === 'daily') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    const buckets = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    return { from, to, buckets, bucketFn: (iso) => `${String(new Date(iso).getHours()).padStart(2, '0')}:00` }
  }
  if (period === 'weekly') {
    const from = new Date(now)
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const buckets: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      buckets.push(days[d.getDay()])
    }
    return { from, to, buckets, bucketFn: (iso) => days[new Date(iso).getDay()] }
  }
  // monthly
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const buckets = Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
  return { from, to, buckets, bucketFn: (iso) => String(new Date(iso).getDate()) }
}

function fmtWeight(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${kg.toFixed(0)}kg`
}

function fmtMinutes(mins: number) {
  if (!mins || isNaN(mins)) return '—'
  if (mins < 60) return `${mins.toFixed(1)}m`
  return `${(mins / 60).toFixed(1)}h`
}

function severity_color(s: string) {
  if (s === 'critical') return '#EF4444'
  if (s === 'warning')  return '#F59E0B'
  return '#6B7280'
}

// ─────────────────────────────────────────────────────────────
// Mini bar chart
// ─────────────────────────────────────────────────────────────
function BarChart({
  data, color, height = 120, showLabels = true, labelEvery = 1,
}: {
  data: { label: string; value: number }[]
  color: string
  height?: number
  showLabels?: boolean
  labelEvery?: number
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: height + 28, position: 'relative' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div
            title={`${d.label}: ${d.value}`}
            style={{
              width: '100%', minHeight: d.value > 0 ? 3 : 0,
              height: `${(d.value / max) * height}px`,
              background: color,
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.4s ease',
              cursor: 'default',
              opacity: 0.85,
            }}
          />
          {showLabels && i % labelEvery === 0 && (
            <div style={{
              fontSize: 9, color: '#94A3B8', marginTop: 4,
              fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap',
            }}>
              {d.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// stacked bar for alerts trend
function StackedBarChart({
  data, height = 120, showLabels = true, labelEvery = 1,
}: {
  data: { label: string; total: number; resolved: number }[]
  height?: number
  showLabels?: boolean
  labelEvery?: number
}) {
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: height + 28 }}>
      {data.map((d, i) => {
        const totalH = (d.total / max) * height
        const resolvedH = d.total > 0 ? (d.resolved / d.total) * totalH : 0
        const unresolvedH = totalH - resolvedH
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', minHeight: d.total > 0 ? 3 : 0 }}>
              <div style={{ height: unresolvedH, background: '#EF4444', borderRadius: unresolvedH > 0 ? '3px 3px 0 0' : 0, opacity: 0.8 }} />
              <div style={{ height: resolvedH,   background: '#10B981', opacity: 0.8 }} />
            </div>
            {showLabels && i % labelEvery === 0 && (
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                {d.label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// donut chart (SVG)
function DonutChart({ segments, size = 100 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = 36, cx = 50, cy = 50, strokeW = 14
  let offset = 0
  const circ = 2 * Math.PI * r

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeW} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const gap  = circ - dash
        const el = (
          <circle key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 0.5s ease' }}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#94A3B8', fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: accent ?? '#0F172A', fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
          {value}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>
      )}
    </div>
  )
}

// section header
function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 2px', fontFamily: 'DM Sans, sans-serif' }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>{sub}</p>
    </div>
  )
}

// card wrapper
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 22px', ...style,
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, background: '#F1F5F9',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ─────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────
async function adminFetch(path: string) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return fetch(path, {
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  })
}

// ─────────────────────────────────────────────────────────────
// Data fetching — queries Supabase directly via client
// ─────────────────────────────────────────────────────────────
async function fetchWeighbridgeStats(period: Period): Promise<WeighbridgeStats> {
  const supabase = getClient()
  const { from, to, buckets, bucketFn } = getPeriodRange(period)

  const { data: rows, error } = await supabase
    .from('weighings')
    .select('entry_at, return_at, net_load, loaded_weight_edited, empty_weight_edited, status, entry_operator_id, operators!entry_operator_id(name)')
    .gte('entry_at', from.toISOString())
    .lte('entry_at', to.toISOString())

  if (error) throw error
  const data = rows ?? []

  const totalTransactions = data.length
  const totalNetWeight    = data.reduce((s, r) => s + (Number(r.net_load) || 0), 0)
  const avgNetWeight      = totalTransactions ? totalNetWeight / totalTransactions : 0
  const editedCount       = data.filter(r => r.loaded_weight_edited || r.empty_weight_edited).length

  // avg transaction time
  const withReturn = data.filter(r => r.entry_at && r.return_at)
  const avgMs = withReturn.length
    ? withReturn.reduce((s, r) => s + (new Date(r.return_at!).getTime() - new Date(r.entry_at!).getTime()), 0) / withReturn.length
    : 0
  const avgTransactionMinutes = avgMs / 60000

  // peak hour
  const hourCounts: Record<string, number> = {}
  data.forEach(r => {
    const h = `${String(new Date(r.entry_at!).getHours()).padStart(2,'0')}:00`
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // status breakdown
  const statusMap: Record<string, number> = {}
  data.forEach(r => { statusMap[r.status ?? 'unknown'] = (statusMap[r.status ?? 'unknown'] ?? 0) + 1 })
  const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }))

  // daily trend
  const trendTx:  Record<string, number> = {}
  const trendWt:  Record<string, number> = {}
  buckets.forEach(b => { trendTx[b] = 0; trendWt[b] = 0 })
  data.forEach(r => {
    const b = bucketFn(r.entry_at!)
    if (b in trendTx) { trendTx[b]++; trendWt[b] += Number(r.net_load) || 0 }
  })
  const dailyTrend = buckets.map(b => ({ label: b, transactions: trendTx[b], netWeight: trendWt[b] }))

  // top operators
  const opMap: Record<string, number> = {}
  data.forEach(r => {
    const op = (r as any).operators
    const name = Array.isArray(op) ? op[0]?.name : op?.name
    if (name) opMap[name] = (opMap[name] ?? 0) + 1
  })
  const topOperators = Object.entries(opMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name,count]) => ({name,count}))

  return { totalTransactions, totalNetWeight, avgNetWeight, avgTransactionMinutes, peakHour, editedCount, statusBreakdown, dailyTrend, topOperators }
}

async function fetchAlertStats(period: Period): Promise<AlertStats> {
  const supabase = getClient()
  const { from, to, buckets, bucketFn } = getPeriodRange(period)

  const { data: rows, error } = await supabase
    .from('alerts')
    .select('severity, event_type, detector, camera_id, is_resolved, created_at, resolved_at')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())

  if (error) throw error
  const data = rows ?? []

  const totalAlerts     = data.length
  const resolvedCount   = data.filter(r => r.is_resolved).length
  const unresolvedCount = totalAlerts - resolvedCount

  // avg resolution time
  const withResolution = data.filter(r => r.is_resolved && r.resolved_at)
  const avgResMs = withResolution.length
    ? withResolution.reduce((s, r) => s + (new Date(r.resolved_at!).getTime() - new Date(r.created_at!).getTime()), 0) / withResolution.length
    : 0
  const avgResolutionMinutes = avgResMs / 60000

  // by severity
  const sevMap: Record<string, number> = {}
  data.forEach(r => { sevMap[r.severity ?? 'info'] = (sevMap[r.severity ?? 'info'] ?? 0) + 1 })
  const bySeverity = Object.entries(sevMap).map(([severity, count]) => ({ severity, count })).sort((a,b)=>b.count-a.count)

  // by event type
  const evMap: Record<string, number> = {}
  data.forEach(r => { evMap[r.event_type] = (evMap[r.event_type] ?? 0) + 1 })
  const byEventType = Object.entries(evMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([event_type,count])=>({event_type,count}))

  // by detector
  const detMap: Record<string, number> = {}
  data.forEach(r => { detMap[r.detector] = (detMap[r.detector] ?? 0) + 1 })
  const byDetector = Object.entries(detMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([detector,count])=>({detector,count}))

  // trend
  const trendTotal:    Record<string, number> = {}
  const trendResolved: Record<string, number> = {}
  buckets.forEach(b => { trendTotal[b] = 0; trendResolved[b] = 0 })
  data.forEach(r => {
    const b = bucketFn(r.created_at!)
    if (b in trendTotal) {
      trendTotal[b]++
      if (r.is_resolved) trendResolved[b]++
    }
  })
  const dailyTrend = buckets.map(b => ({ label: b, total: trendTotal[b], resolved: trendResolved[b] }))

  // top cameras
  const camMap: Record<string, number> = {}
  data.forEach(r => { if (r.camera_id) camMap[r.camera_id] = (camMap[r.camera_id] ?? 0) + 1 })
  const topCameras = Object.entries(camMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([camera_id,count])=>({camera_id,count}))

  return { totalAlerts, unresolvedCount, resolvedCount, avgResolutionMinutes, bySeverity, byEventType, byDetector, dailyTrend, topCameras }
}

// ─────────────────────────────────────────────────────────────
// Period pill selector
// ─────────────────────────────────────────────────────────────
function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{
      display: 'inline-flex', background: '#F1F5F9',
      borderRadius: 8, padding: 3, gap: 2,
    }}>
      {(['daily','weekly','monthly'] as Period[]).map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: '6px 16px', borderRadius: 6, border: 'none',
          background: value === p ? 'white' : 'transparent',
          boxShadow: value === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          color: value === p ? '#0F172A' : '#64748B',
          fontSize: 12, fontWeight: value === p ? 700 : 500,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          transition: 'all 0.15s',
          textTransform: 'capitalize',
        }}>
          {p}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Chart card with title
// ─────────────────────────────────────────────────────────────
function ChartCard({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Card style={style}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>
        {title}
      </div>
      {children}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period,  setPeriod]  = useState<Period>('weekly')
  const [wStats,  setWStats]  = useState<WeighbridgeStats | null>(null)
  const [aStats,  setAStats]  = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (p: Period) => {
    setLoading(true); setError(null)
    try {
      const [ws, as] = await Promise.all([fetchWeighbridgeStats(p), fetchAlertStats(p)])
      setWStats(ws); setAStats(as)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load report data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month'

  // chart data helpers
  const wTrendTx  = wStats?.dailyTrend.map(d => ({ label: d.label, value: d.transactions })) ?? []
  const wTrendWt  = wStats?.dailyTrend.map(d => ({ label: d.label, value: d.netWeight })) ?? []
  const labelEvery = period === 'daily' ? 4 : period === 'monthly' ? 5 : 1

  const resolutionRate = aStats ? Math.round((aStats.resolvedCount / (aStats.totalAlerts || 1)) * 100) : 0

  return (
    <div style={{
      flex: 1, overflowY: 'auto', background: '#F8F9FA',
      padding: '32px 36px 64px',
      fontFamily: 'DM Sans, sans-serif',
    }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 32,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
            Reports & Analytics
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Operational insights across weighbridge and security systems
          </p>
        </div>
        <PeriodSelector value={period} onChange={p => { setPeriod(p); }} />
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          fontSize: 13, color: '#DC2626',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ══════════════════════════════════════════
          WEIGHBRIDGE SECTION
      ══════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16,
      }}>
        <div style={{
          width: 3, height: 20, background: '#2563EB', borderRadius: 2, flexShrink: 0,
        }} />
        <SectionHeader
          title="Weighbridge"
          sub={`Weight scale performance — ${periodLabel}`}
        />
      </div>

      {/* Stat cards row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <Card key={i}>
              <Skel w="60%" h={10} />
              <div style={{ marginTop: 10 }}><Skel w="40%" h={28} /></div>
              <div style={{ marginTop: 8 }}><Skel w="70%" h={10} /></div>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="TOTAL TRANSACTIONS"
              value={String(wStats?.totalTransactions ?? 0)}
              sub={periodLabel}
            />
            <StatCard
              label="TOTAL NET WEIGHT"
              value={fmtWeight(wStats?.totalNetWeight ?? 0)}
              sub={`avg ${fmtWeight(wStats?.avgNetWeight ?? 0)} / truck`}
            />
            <StatCard
              label="AVG. TRANSACTION TIME"
              value={fmtMinutes(wStats?.avgTransactionMinutes ?? 0)}
              sub="entry to exit"
            />
            <StatCard
              label="PEAK HOUR"
              value={wStats?.peakHour ?? '—'}
              sub={`${wStats?.editedCount ?? 0} operator-edited entries`}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <ChartCard title="TRANSACTIONS OVER TIME">
          {loading
            ? <Skel h={120} />
            : <BarChart data={wTrendTx} color="#2563EB" height={120} labelEvery={labelEvery} />
          }
        </ChartCard>
        <ChartCard title="NET WEIGHT OVER TIME (KG)">
          {loading
            ? <Skel h={120} />
            : <BarChart data={wTrendWt} color="#0891B2" height={120} labelEvery={labelEvery} />
          }
        </ChartCard>
      </div>

      {/* Operator table + status donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 40 }}>
        <ChartCard title="TOP OPERATORS BY TRANSACTIONS">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <Skel key={i} h={28} />)}
            </div>
          ) : wStats?.topOperators.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>No data for this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {wStats!.topOperators.map((op, i) => {
                const pct = Math.round((op.count / (wStats!.topOperators[0]?.count || 1)) * 100)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#475569', width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'DM Sans, sans-serif' }}>
                      {op.name}
                    </div>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2563EB', borderRadius: 4, opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 600, width: 28, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
                      {op.count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard title="STATUS BREAKDOWN" style={{ minWidth: 200 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}><Skel w={100} h={100} r={50} /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <DonutChart
                size={90}
                segments={(wStats?.statusBreakdown ?? []).map(s => ({
                  value: s.count,
                  label: s.status,
                  color: s.status === 'complete' ? '#059669' : s.status === 'waiting' ? '#F59E0B' : '#6B7280',
                }))}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {(wStats?.statusBreakdown ?? []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                        background: s.status === 'complete' ? '#059669' : s.status === 'waiting' ? '#F59E0B' : '#6B7280',
                      }} />
                      <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif' }}>{s.status}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: 'DM Mono, monospace' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ══════════════════════════════════════════
          ALERTS SECTION
      ══════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 20, background: '#EF4444', borderRadius: 2, flexShrink: 0 }} />
        <SectionHeader
          title="Security Alerts"
          sub={`Alert system performance — ${periodLabel}`}
        />
      </div>

      {/* Alert stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <Card key={i}>
              <Skel w="60%" h={10} />
              <div style={{ marginTop: 10 }}><Skel w="40%" h={28} /></div>
              <div style={{ marginTop: 8 }}><Skel w="70%" h={10} /></div>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="TOTAL ALERTS"
              value={String(aStats?.totalAlerts ?? 0)}
              sub={periodLabel}
            />
            <StatCard
              label="UNRESOLVED"
              value={String(aStats?.unresolvedCount ?? 0)}
              sub={`${resolutionRate}% resolution rate`}
              accent={aStats && aStats.unresolvedCount > 0 ? '#EF4444' : undefined}
            />
            <StatCard
              label="RESOLVED"
              value={String(aStats?.resolvedCount ?? 0)}
              sub={`${resolutionRate}% of all alerts`}
              accent="#059669"
            />
            <StatCard
              label="AVG. RESOLUTION TIME"
              value={fmtMinutes(aStats?.avgResolutionMinutes ?? 0)}
              sub="from trigger to resolved"
            />
          </>
        )}
      </div>

      {/* Alert trend chart + severity donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 20 }}>
        <ChartCard title="ALERTS OVER TIME  ·  ■ UNRESOLVED  ■ RESOLVED">
          {loading
            ? <Skel h={120} />
            : <>
                <StackedBarChart data={aStats?.dailyTrend ?? []} height={120} labelEvery={labelEvery} />
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B', fontFamily: 'DM Sans, sans-serif' }}>
                    <div style={{ width: 10, height: 10, background: '#EF4444', borderRadius: 2, opacity: 0.8 }} /> Unresolved
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B', fontFamily: 'DM Sans, sans-serif' }}>
                    <div style={{ width: 10, height: 10, background: '#10B981', borderRadius: 2, opacity: 0.8 }} /> Resolved
                  </div>
                </div>
              </>
          }
        </ChartCard>

        <ChartCard title="BY SEVERITY" style={{ minWidth: 200 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}><Skel w={100} h={100} r={50} /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <DonutChart
                size={90}
                segments={(aStats?.bySeverity ?? []).map(s => ({
                  value: s.count,
                  label: s.severity,
                  color: severity_color(s.severity),
                }))}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {(aStats?.bySeverity ?? []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: severity_color(s.severity) }} />
                      <span style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif' }}>{s.severity}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: 'DM Mono, monospace' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Event type + detector + top cameras */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* By event type */}
        <ChartCard title="BY EVENT TYPE">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3,4].map(i => <Skel key={i} h={22} />)}
            </div>
          ) : (aStats?.byEventType.length ?? 0) === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>No alerts this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aStats!.byEventType.map((e, i) => {
                const pct = Math.round((e.count / (aStats!.totalAlerts || 1)) * 100)
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#475569', fontFamily: 'DM Sans, sans-serif', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.event_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: 'DM Mono, monospace' }}>{e.count}</span>
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>

        {/* By detector */}
        <ChartCard title="BY DETECTOR">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <Skel key={i} h={22} />)}
            </div>
          ) : (aStats?.byDetector.length ?? 0) === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>No alerts this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aStats!.byDetector.map((d, i) => {
                const pct = Math.round((d.count / (aStats!.byDetector[0]?.count || 1)) * 100)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: '#F8FAFF', border: '1px solid #E2E8F0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#475569', fontFamily: 'DM Sans, sans-serif', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.detector}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: '#0F172A' }}>{d.count}</span>
                      </div>
                      <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#7C3AED', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>

        {/* Top cameras */}
        <ChartCard title="TOP CAMERAS BY ALERTS">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <Skel key={i} h={28} />)}
            </div>
          ) : (aStats?.topCameras.length ?? 0) === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>No camera data this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aStats!.topCameras.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 7,
                  background: i === 0 ? '#FEF2F2' : '#F8F9FA',
                  border: `1px solid ${i === 0 ? '#FECACA' : '#E2E8F0'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: i === 0 ? '#EF4444' : '#94A3B8',
                      fontFamily: 'DM Mono, monospace',
                    }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: '#475569', fontFamily: 'DM Sans, sans-serif' }}>
                      {c.camera_id}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: i === 0 ? '#EF4444' : '#0F172A',
                    fontFamily: 'DM Mono, monospace',
                  }}>
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}