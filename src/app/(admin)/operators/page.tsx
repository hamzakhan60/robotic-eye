// app/(admin)/operators/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────
interface Operator {
  id: string
  name: string
  employee_id: string
  role: 'operator' | 'admin'
  is_active: boolean
  phone: string | null
  avatar_url: string | null
  last_active_at: string | null
  created_at: string
  auth_user_id: string | null
}

interface Invite {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
  token: string
}

// ── Helpers ───────────────────────────────────────────────────
const TZ = 'Asia/Karachi'

function relativeTime(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function pkTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: TZ, day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// FIX 1: Avatar colors — palette distinct from the active tab color (#0F172A)
// Removed #2563EB (same blue as invite button) and avoided dark navy.
function avatarColor(name: string) {
  const colors = ['#0D9488', '#EA580C', '#7C3AED', '#0284C7', '#BE185D', '#65A30D']
  let h = 0; for (const c of name) h = c.charCodeAt(0) + h * 31
  return colors[Math.abs(h) % colors.length]
}

// ── API helper ────────────────────────────────────────────────
async function adminFetch(path: string, opts: RequestInit = {}) {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...(opts.headers ?? {}),
    },
  })
  return res
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 38 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const showImage = avatarUrl && !imgError

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: showImage ? 'transparent' : avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{
          fontSize: size * 0.35, fontWeight: 700,
          color: 'white', fontFamily: 'DM Sans, sans-serif',
          letterSpacing: '0.03em',
        }}>
          {initials(name)}
        </span>
      )}
    </div>
  )
}

// ── Role Badge ────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      padding: '3px 9px', borderRadius: 4,
      background: isAdmin ? '#EFF6FF' : '#F1F5F9',
      color: isAdmin ? '#1D4ED8' : '#64748B',
      fontFamily: 'DM Sans, sans-serif',
      border: isAdmin ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
      // FIX 4: inline-block so it doesn't stretch and bleed into adjacent cell
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {role.toUpperCase()}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600,
      color: active ? '#059669' : '#94A3B8',
      fontFamily: 'DM Sans, sans-serif',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? '#059669' : '#CBD5E1',
        flexShrink: 0,
      }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Invite Panel (right slide-in) ─────────────────────────────
function InvitePanel({
  onClose, onInvited, invites, revoking, onRevoke,
}: {
  onClose: () => void
  onInvited: () => void
  invites: Invite[]
  revoking: string | null
  onRevoke: (inv: Invite) => void
}) {
  const [email,   setEmail]   = useState('')
  // FIX 3: Role is always 'operator' — no admin option exposed
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address'); return
    }
    setSending(true); setError(null)
    try {
      const res = await adminFetch('/api/admin/invite-operator', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role: 'operator' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send invite'); setSending(false); return }
      setSuccess(true)
      setEmail('')
      setTimeout(() => { setSuccess(false); onInvited() }, 2000)
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
      setSending(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.3)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'relative', width: 380, height: '100%',
        background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 17, fontWeight: 700, color: '#0F172A',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Invite Operator
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94A3B8', padding: 4, lineHeight: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#DC2626', marginBottom: 16,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#059669', marginBottom: 16,
              fontFamily: 'DM Sans, sans-serif', display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Invite sent successfully!
            </div>
          )}

          {/* Email */}
          <PanelField label="EMAIL ADDRESS">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="operator@factory.com"
              type="email"
              style={panelInputStyle}
            />
          </PanelField>

          {/* FIX 3: Role selector removed — always sends as 'operator' */}
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            background: '#F8FAFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#64748B" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#0F172A',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                Operator
              </div>
              <div style={{
                fontSize: 11, color: '#94A3B8',
                fontFamily: 'DM Sans, sans-serif', marginTop: 1,
              }}>
                Weighbridge confirmations only
              </div>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: '100%', height: 44, marginTop: 20,
              background: sending ? '#93C5FD' : '#2563EB',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
              cursor: sending ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {sending ? (
              <>
                <span style={{
                  width: 12, height: 12,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
                Sending…
              </>
            ) : 'SEND INVITE'}
          </button>
        </div>

        {/* Pending invites list */}
        {invites.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: '#94A3B8', fontFamily: 'DM Sans, sans-serif',
              marginBottom: 12,
            }}>
              PENDING INVITES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invites.map(inv => {
                const expired = new Date(inv.expires_at) < new Date()
                return (
                  <div key={inv.id} style={{
                    border: '1px solid #E2E8F0', borderRadius: 8,
                    padding: '12px 14px',
                    background: expired ? '#FFFBEB' : 'white',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: '#0F172A',
                        fontFamily: 'DM Mono, monospace',
                        wordBreak: 'break-all',
                      }}>
                        {inv.email}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                        padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginLeft: 8,
                        background: expired ? '#FEF3C7' : '#EFF6FF',
                        color: expired ? '#92400E' : '#1D4ED8',
                        border: expired ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                        fontFamily: 'DM Sans, sans-serif',
                      }}>
                        {expired ? 'EXPIRED' : 'PENDING'}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginTop: 8,
                    }}>
                      <span style={{
                        fontSize: 11, color: '#94A3B8',
                        fontFamily: 'DM Sans, sans-serif',
                      }}>
                        Sent {relativeTime(inv.created_at)}
                      </span>
                      <button
                        onClick={() => onRevoke(inv)}
                        disabled={revoking === inv.id}
                        style={{
                          fontSize: 12, fontWeight: 600, color: '#2563EB',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, fontFamily: 'DM Sans, sans-serif',
                          opacity: revoking === inv.id ? 0.4 : 1,
                        }}>
                        {revoking === inv.id ? 'Revoking…' : 'Resend'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: '#94A3B8', display: 'block', marginBottom: 7,
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const panelInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 13, fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#0F172A', boxSizing: 'border-box',
  background: 'white',
}

// ── Toggle Confirm Modal ──────────────────────────────────────
function ToggleModal({
  op, onClose, onConfirm, loading,
}: {
  op: Operator
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  const deactivating = op.is_active
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, width: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        padding: 28,
      }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: deactivating ? '#FEF2F2' : '#F0FDF4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          {deactivating ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#059669" strokeWidth="2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          )}
        </div>

        <div style={{
          fontSize: 16, fontWeight: 700, color: '#0F172A',
          fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
        }}>
          {deactivating ? 'Deactivate' : 'Reactivate'} {op.name}?
        </div>
        <div style={{
          fontSize: 13, color: '#64748B',
          fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 24,
        }}>
          {deactivating
            ? 'They will lose portal access immediately on their next page load.'
            : 'They will regain full portal access immediately.'}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 40, background: 'white',
            border: '1px solid #E2E8F0', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: '#475569', fontFamily: 'DM Sans, sans-serif',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, height: 40,
            background: loading ? '#94A3B8' : (deactivating ? '#DC2626' : '#059669'),
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'white', fontFamily: 'DM Sans, sans-serif',
            letterSpacing: '0.04em',
          }}>
            {loading ? 'Please wait…' : (deactivating ? 'Deactivate' : 'Reactivate')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function OperatorsPage() {
  const [operators,    setOperators]    = useState<Operator[]>([])
  const [invites,      setInvites]      = useState<Invite[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showInvite,   setShowInvite]   = useState(false)
  const [tab,          setTab]          = useState<'active' | 'inactive'>('active')
  const [search,       setSearch]       = useState('')
  const [toggleTarget, setToggleTarget] = useState<Operator | null>(null)
  const [toggling,     setToggling]     = useState(false)
  const [revoking,     setRevoking]     = useState<string | null>(null)
  const [toastMsg,     setToastMsg]     = useState<string | null>(null)
  const [toastType,    setToastType]    = useState<'ok' | 'err'>('ok')
  // FIX 2: track current logged-in user's auth ID to exclude from list
  const [currentAuthId, setCurrentAuthId] = useState<string | null>(null)

  const toast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToastMsg(msg); setToastType(type)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // FIX 2: load the current session user ID on mount
  useEffect(() => {
    const supabase = getClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentAuthId(session?.user?.id ?? null)
    })
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await adminFetch('/api/admin/operators')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load') }
      else { setOperators(data.operators ?? []); setInvites(data.invites ?? []) }
    } catch (e: any) { setError(e?.message ?? 'Network error') }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const supabase = getClient()
    const ch = supabase.channel('ops_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operators' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_invites' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchAll])

  const handleToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    const isActive = toggleTarget.is_active
    const res = isActive
      ? await adminFetch(`/api/admin/operators?id=${toggleTarget.id}`, { method: 'DELETE' })
      : await adminFetch('/api/admin/operators', {
          method: 'PATCH',
          body: JSON.stringify({ id: toggleTarget.id, is_active: true }),
        })
    const data = await res.json()
    if (!res.ok) {
      toast(`Error: ${data.error}`, 'err')
    } else {
      setOperators(prev => prev.map(o =>
        o.id === toggleTarget.id ? { ...o, is_active: !isActive } : o
      ))
      toast(`${toggleTarget.name} ${isActive ? 'deactivated' : 'reactivated'}`)
    }
    setToggling(false)
    setToggleTarget(null)
  }

  const handleRevoke = async (inv: Invite) => {
    setRevoking(inv.id)
    const res  = await adminFetch(`/api/admin/operators?invite_id=${inv.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast(`Error: ${data.error}`, 'err') }
    else { setInvites(prev => prev.filter(i => i.id !== inv.id)); toast(`Invite revoked`) }
    setRevoking(null)
  }

  const q = search.toLowerCase()

  // FIX 2: exclude the currently logged-in admin from the displayed list
  const visibleOperators = currentAuthId
    ? operators.filter(o => o.auth_user_id !== currentAuthId)
    : operators

  const activeOps   = visibleOperators.filter(o =>  o.is_active && (!q || o.name.toLowerCase().includes(q) || o.employee_id.toLowerCase().includes(q)))
  const inactiveOps = visibleOperators.filter(o => !o.is_active && (!q || o.name.toLowerCase().includes(q) || o.employee_id.toLowerCase().includes(q)))
  const displayed   = tab === 'active' ? activeOps : inactiveOps

  // FIX 4: widen Role and Status columns so they don't overlap
  // Before: '2fr 130px 110px 130px 160px 100px'
  const COL = '2fr 130px 120px 120px 160px 100px'

  return (
    <>
      {/* Modals */}
      {showInvite && (
        <InvitePanel
          onClose={() => setShowInvite(false)}
          onInvited={fetchAll}
          invites={invites}
          revoking={revoking}
          onRevoke={handleRevoke}
        />
      )}
      {toggleTarget && (
        <ToggleModal
          op={toggleTarget}
          onClose={() => setToggleTarget(null)}
          onConfirm={handleToggle}
          loading={toggling}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          background: toastType === 'err' ? '#DC2626' : '#0F172A',
          color: 'white', borderRadius: 8, padding: '12px 18px',
          fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'fadein 0.2s ease',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toastType === 'ok' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          )}
          {toastMsg}
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto', background: '#F8F9FA',
        padding: '32px 36px 48px',
        fontFamily: 'DM Sans, sans-serif',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', marginBottom: 28,
        }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 700, color: '#0F172A',
              margin: '0 0 4px',
            }}>
              Operators
            </h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
              {visibleOperators.filter(o => o.is_active).length} active ·{' '}
              {invites.length} pending invite{invites.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#2563EB', color: 'white',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
              cursor: 'pointer',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            INVITE OPERATOR
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            fontSize: 13, color: '#DC2626',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Tabs + Search ── */}
        <div style={{
          background: 'white', borderRadius: 10, border: '1px solid #E2E8F0',
          padding: '12px 20px', marginBottom: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
          borderBottom: 'none',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { key: 'active',   label: 'Active',   count: visibleOperators.filter(o =>  o.is_active).length },
              { key: 'inactive', label: 'Inactive', count: visibleOperators.filter(o => !o.is_active).length },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '6px 14px', borderRadius: 7,
                border: tab === t.key ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                background: tab === t.key ? '#0F172A' : 'white',
                color: tab === t.key ? 'white' : '#64748B',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                <span style={{
                  background: tab === t.key ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                  color: tab === t.key ? 'white' : '#64748B',
                  fontSize: 10, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 10, fontFamily: 'DM Mono, monospace',
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 10, top: '50%',
                       transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or ID…"
              style={{
                width: '100%', padding: '7px 12px 7px 30px',
                border: '1px solid #E2E8F0', borderRadius: 7,
                fontSize: 12, outline: 'none',
                color: '#0F172A', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: 'white', border: '1px solid #E2E8F0',
          borderRadius: 10, borderTopLeftRadius: 0, borderTopRightRadius: 0,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: COL,
            padding: '9px 20px', background: '#F8F9FA',
            borderBottom: '1px solid #E2E8F0',
          }}>
            {['OPERATOR', 'EMPLOYEE ID', 'ROLE', 'STATUS', 'LAST ACTIVE', ''].map(h => (
              <div key={h} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                color: '#94A3B8',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: COL,
                  padding: '16px 20px', borderBottom: '1px solid #F1F5F9',
                  alignItems: 'center', gap: 8,
                }}>
                  {[2, 1, 1, 1, 1.5, 0.8].map((w, j) => (
                    <div key={j} style={{
                      height: 12, borderRadius: 6,
                      background: '#F1F5F9',
                      width: `${w * 60}px`,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div style={{
              padding: '64px 0', textAlign: 'center', color: '#94A3B8',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"
                style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {search ? 'No operators match your search' : `No ${tab} operators`}
              </div>
              <div style={{ fontSize: 12 }}>
                {!search && tab === 'active' && 'Invite an operator to get started'}
              </div>
            </div>
          ) : (
            displayed.map((op, i) => (
              <div key={op.id} style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '14px 20px', alignItems: 'center',
                borderBottom: i < displayed.length - 1 ? '1px solid #F1F5F9' : 'none',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                {/* Operator name + avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={op.name} avatarUrl={op.avatar_url} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#0F172A',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {op.name}
                    </div>
                    {op.phone && (
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                        {op.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Employee ID */}
                <div style={{
                  fontSize: 12, fontFamily: 'DM Mono, monospace',
                  color: '#475569', fontWeight: 500,
                }}>
                  {op.employee_id}
                </div>

                {/* Role — FIX 4: inline-block + overflow:visible on cell */}
                <div style={{ overflow: 'visible' }}>
                  <RoleBadge role={op.role} />
                </div>

                {/* Status */}
                <div style={{ overflow: 'visible' }}>
                  <StatusBadge active={op.is_active} />
                </div>

                {/* Last active */}
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {relativeTime(op.last_active_at)}
                </div>

                {/* Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setToggleTarget(op)}
                    style={{
                      fontSize: 12, fontWeight: 600,
                      color: op.is_active ? '#DC2626' : '#059669',
                      background: op.is_active ? '#FEF2F2' : '#F0FDF4',
                      border: op.is_active ? '1px solid #FECACA' : '1px solid #BBF7D0',
                      borderRadius: 6, padding: '5px 12px',
                      cursor: 'pointer',
                    }}>
                    {op.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
      `}</style>
    </>
  )
}   