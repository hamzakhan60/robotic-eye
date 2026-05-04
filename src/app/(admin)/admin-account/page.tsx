// app/(admin)/account/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useAdminAccount } from '@/lib/hooks/useAdminAccount'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Tab = 'profile' | 'security' | 'notifications'

// ─────────────────────────────────────────────────────────────
// Tiny primitives
// ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 48, height: 26,
        borderRadius: 13, border: 'none', flexShrink: 0,
        cursor: 'pointer',
        background: on ? '#2563EB' : '#CBD5E1',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: on ? 25 : 3, width: 20, height: 20,
        borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', color: '#94A3B8',
      fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
    }}>
      {children}
    </label>
  )
}

const LOCK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, readOnly = false,
  type = 'text', rightIcon, hint,
}: {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  type?: string
  rightIcon?: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: rightIcon ? '10px 40px 10px 13px' : '10px 13px',
            border: '1px solid #E2E8F0', borderRadius: 8,
            fontSize: 13, fontFamily: 'DM Sans, sans-serif',
            color: readOnly ? '#94A3B8' : '#0F172A',
            background: readOnly ? '#F8F9FA' : 'white',
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = '#2563EB' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
        />
        {rightIcon && (
          <span style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)', color: '#94A3B8',
            display: 'flex', alignItems: 'center', pointerEvents: 'none',
          }}>
            {rightIcon}
          </span>
        )}
      </div>
      {hint && (
        <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94A3B8', fontFamily: 'DM Sans, sans-serif' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function PasswordInput({
  value, onChange, placeholder, show, onToggleShow,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  show: boolean
  onToggleShow: () => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 40px 10px 13px',
          border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          color: '#0F172A', background: 'white',
          outline: 'none', transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#2563EB' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
      />
      <button
        type="button"
        onClick={onToggleShow}
        style={{
          position: 'absolute', right: 11, top: '50%',
          transform: 'translateY(-50%)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
          color: '#94A3B8', lineHeight: 0,
        }}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function StrengthBar({ password }: { password: string }) {
  if (!password) return null
  const hasUpper   = /[A-Z]/.test(password)
  const hasNum     = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  const score = (password.length >= 8 ? 1 : 0)
    + (password.length >= 12 ? 1 : 0)
    + (hasUpper ? 1 : 0)
    + (hasNum ? 1 : 0)
    + (hasSpecial ? 1 : 0)
  const s = score <= 1 ? 1 : score <= 2 ? 2 : score <= 3 ? 3 : 4
  const colors = ['', '#EF4444', '#F59E0B', '#2563EB', '#059669']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= s ? colors[s] : '#E2E8F0',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: colors[s], fontFamily: 'DM Sans, sans-serif' }}>
        {labels[s]}
      </span>
    </div>
  )
}

function PrimaryButton({
  onClick, disabled, loading: busy, children,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  const off = disabled || busy
  return (
    <button
      onClick={onClick}
      disabled={off}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: off ? '#93C5FD' : '#2563EB',
        color: 'white', border: 'none', borderRadius: 8,
        padding: '11px 28px', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.07em', cursor: off ? 'not-allowed' : 'pointer',
        fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!off) (e.currentTarget as HTMLElement).style.background = '#1D4ED8' }}
      onMouseLeave={e => { if (!off) (e.currentTarget as HTMLElement).style.background = '#2563EB' }}
    >
      {busy && (
        <span style={{
          width: 12, height: 12, display: 'inline-block',
          border: '2px solid rgba(255,255,255,0.35)',
          borderTopColor: 'white', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: '#F1F5F9', animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

function PageSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '0 36px 64px', alignItems: 'flex-start' }}>
      <div style={{
        width: 260, flexShrink: 0, background: 'white',
        border: '1px solid #E2E8F0', borderRadius: 14, padding: '28px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <Skel w={100} h={100} r={50} />
        <Skel w="70%" h={16} />
        <Skel w="50%" h={10} />
        <Skel w="60%" h={26} r={5} />
        <Skel w="100%" h={72} r={8} />
        <Skel w="100%" h={40} r={8} />
      </div>
      <div style={{ flex: 1, background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '16px 28px', gap: 24 }}>
          <Skel w={60} h={14} /><Skel w={60} h={14} /><Skel w={100} h={14} />
        </div>
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i}>
              <Skel w="28%" h={10} /><div style={{ height: 8 }}/>
              <Skel h={40} r={8} />
            </div>
          ))}
          <Skel w={150} h={44} r={8} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Avatar helpers
// ─────────────────────────────────────────────────────────────
function avatarInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function avatarBg(name: string) {
  const colors = ['#0D9488', '#EA580C', '#7C3AED', '#0284C7', '#BE185D', '#65A30D']
  let h = 0; for (const c of name) h = c.charCodeAt(0) + h * 31
  return colors[Math.abs(h) % colors.length]
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────
// Info box (used in session section)
// ─────────────────────────────────────────────────────────────
function InfoBox({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div style={{
      padding: '14px 16px', background: '#F8F9FA',
      border: '1px solid #E2E8F0', borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 10, fontFamily: 'DM Sans, sans-serif' }}>
        SESSION INFO
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ fontSize: 12, color: '#475569', fontFamily: 'DM Mono, monospace', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function AdminAccountPage() {
  const {
    profile, loading, saving, uploadingPhoto,
    error, successMsg,
    notifPrefs, pushPermission,
    userEmail,
    updateProfile, changePassword,
    uploadAvatar, removeAvatar,
    updateNotifPrefs, requestBrowserPush,
  } = useAdminAccount()

  const [tab, setTab] = useState<Tab>('profile')
  const fileRef = useRef<HTMLInputElement>(null)

  // Profile form
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [profInit, setProfInit] = useState(false)

  // Security form
  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwError,     setPwError]     = useState<string | null>(null)

  // Populate once profile loads
  if (profile && !profInit) {
    setName(profile.name)
    setPhone(profile.phone ?? '')
    setProfInit(true)
  }

  const handleSaveProfile = () => {
    if (!name.trim()) return
    updateProfile(name.trim(), phone.trim())
  }

  const handleChangePw = async () => {
    setPwError(null)
    if (!currentPw)          { setPwError('Enter your current password'); return }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    const ok = await changePassword(currentPw, newPw)
    if (ok) { setCurrentPw(''); setNewPw(''); setConfirmPw('') }
  }

  const profileChanged =
    name.trim() !== (profile?.name ?? '') ||
    phone.trim() !== (profile?.phone ?? '')

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#F8F9FA', fontFamily: 'DM Sans, sans-serif', minHeight: '100vh' }}>
        <div style={{ padding: '28px 36px 20px' }}><Skel w={160} h={13} /></div>
        <div style={{ padding: '0 36px 24px' }}>
          <Skel w={180} h={26} /><div style={{ height: 8 }}/><Skel w={320} h={13} />
        </div>
        <PageSkeleton />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',       label: 'Profile' },
    { key: 'security',      label: 'Security' },

  ]

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, overflowY: 'auto', background: '#F8F9FA',
      fontFamily: 'DM Sans, sans-serif', minHeight: '100vh',
    }}>

      {/* ── Breadcrumb ── */}
      <div style={{ padding: '28px 36px 20px' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <a href="/admin" style={{ color: '#94A3B8', textDecoration: 'none' }}>Dashboard</a>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round">
            <path d="M9 5l7 7-7 7"/>
          </svg>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>My Account</span>
        </nav>
      </div>

      {/* ── Page header ── */}
      <div style={{ padding: '0 36px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>My Account</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
          Manage your profile, password and notification preferences
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'flex', gap: 20, padding: '0 36px 64px', alignItems: 'flex-start' }}>

        {/* ══════════════════════════════════════════
            LEFT — Identity card
        ══════════════════════════════════════════ */}
        <div style={{
          width: 260, flexShrink: 0, background: 'white',
          border: '1px solid #E2E8F0', borderRadius: 14,
          padding: '28px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>

          {/* Avatar */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            {uploadingPhoto ? (
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: '#F1F5F9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  border: '2.5px solid #E2E8F0', borderTopColor: '#2563EB',
                  animation: 'spin 0.7s linear infinite', display: 'block',
                }} />
              </div>
            ) : profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: avatarBg(profile?.name ?? 'Admin'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: 'white' }}>
                  {avatarInitials(profile?.name ?? 'AD')}
                </span>
              </div>
            )}
          </div>

          {/* Name */}
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
            {profile?.name ?? '—'}
          </div>

          {/* Employee ID */}
          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'DM Mono, monospace', marginBottom: 14 }}>
            {profile?.employee_id ?? '—'}
          </div>

          {/* Role badge */}
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 5, marginBottom: 12,
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            color: '#1D4ED8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          }}>
            {(profile?.role ?? 'ADMIN').toUpperCase()}
          </span>

          {/* Active status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: profile?.is_active ? '#059669' : '#CBD5E1',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', letterSpacing: '0.06em' }}>
              {profile?.is_active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          {/* Member since */}
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16 }}>
            Member since {profile?.created_at ? fmtDate(profile.created_at) : '—'}
          </div>

          {/* Last active */}
          {profile?.last_active_at && (
            <div style={{
              width: '100%', background: '#F8F9FA', borderRadius: 8,
              border: '1px solid #E2E8F0', padding: '10px 12px',
              marginBottom: 10, textAlign: 'left',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 3 }}>
                LAST ACTIVE
              </div>
              <div style={{ fontSize: 11, color: '#475569', fontFamily: 'DM Mono, monospace' }}>
                {fmtDateTime(profile.last_active_at)}
              </div>
            </div>
          )}

          {/* Email */}
          <div style={{
            width: '100%', background: '#F8F9FA', borderRadius: 8,
            border: '1px solid #E2E8F0', padding: '10px 12px',
            marginBottom: 20, textAlign: 'left',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 3 }}>
              EMAIL
            </div>
            <div style={{
              fontSize: 11, color: '#475569', fontFamily: 'DM Mono, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {userEmail || '—'}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />

          {/* Change photo */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto || saving}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '10px 0', background: 'white',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
              color: '#475569', cursor: (uploadingPhoto || saving) ? 'not-allowed' : 'pointer',
              opacity: (uploadingPhoto || saving) ? 0.5 : 1,
              transition: 'background 0.15s', fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => { if (!uploadingPhoto && !saving) e.currentTarget.style.background = '#F8F9FA' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {uploadingPhoto ? 'UPLOADING…' : 'CHANGE PHOTO'}
          </button>

          {/* Remove photo */}
          {profile?.avatar_url && !uploadingPhoto && (
            <button
              onClick={removeAvatar}
              disabled={saving}
              style={{
                width: '100%', marginTop: 8,
                border: '1px solid #FECACA', borderRadius: 8,
                padding: '9px 0', background: 'white',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                color: '#DC2626', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1, transition: 'background 0.15s',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
            >
              REMOVE PHOTO
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════
            RIGHT — Tabs panel
        ══════════════════════════════════════════ */}
        <div style={{
          flex: 1, background: 'white',
          border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden',
        }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '16px 28px', border: 'none', background: 'none',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', cursor: 'pointer',
                color: tab === t.key ? '#2563EB' : '#94A3B8',
                position: 'relative', transition: 'color 0.15s',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {t.label}
                {tab === t.key && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: 2, background: '#2563EB', borderRadius: '2px 2px 0 0',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Global banners */}
          {(successMsg || error) && (
            <div style={{ padding: '16px 28px 0' }}>
              {successMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#059669', fontFamily: 'DM Sans, sans-serif',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  {successMsg}
                </div>
              )}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#DC2626', fontFamily: 'DM Sans, sans-serif',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ══════ PROFILE TAB ══════ */}
          {tab === 'profile' && (
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

              <Field label="FULL NAME">
                <TextInput value={name} onChange={setName} placeholder="Your full name" />
              </Field>

              <Field label="PHONE NUMBER">
                <TextInput value={phone} onChange={setPhone} placeholder="+92 300 0000000" />
              </Field>

              <Field label="EMAIL ADDRESS">
                <TextInput
                  value={userEmail}
                  readOnly
                  rightIcon={LOCK_ICON}
                  hint="Email is managed by Supabase Auth and cannot be changed here."
                />
              </Field>

              <Field label="EMPLOYEE ID">
                <TextInput
                  value={profile?.employee_id ?? '—'}
                  readOnly
                  rightIcon={LOCK_ICON}
                />
              </Field>

              <Field label="ROLE">
                <TextInput
                  value={(profile?.role ?? 'admin').charAt(0).toUpperCase() + (profile?.role ?? 'admin').slice(1)}
                  readOnly
                  rightIcon={LOCK_ICON}
                />
              </Field>

              <div style={{ paddingTop: 4 }}>
                <PrimaryButton
                  onClick={handleSaveProfile}
                  disabled={!name.trim() || !profileChanged}
                  loading={saving}
                >
                  {saving ? 'Saving…' : 'SAVE CHANGES'}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* ══════ SECURITY TAB ══════ */}
          {tab === 'security' && (
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Notice */}
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: '#F8FAFF', border: '1px solid #BFDBFE',
                borderRadius: 8, padding: '12px 14px',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ margin: 0, fontSize: 12, color: '#1D4ED8', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
                  We verify your current password before applying any change. This will sign you out of all other active sessions.
                </p>
              </div>

              <Field label="CURRENT PASSWORD">
                <PasswordInput
                  value={currentPw}
                  onChange={setCurrentPw}
                  placeholder="Enter your current password"
                  show={showCurrent}
                  onToggleShow={() => setShowCurrent(v => !v)}
                />
              </Field>

              <div style={{ borderTop: '1px dashed #E2E8F0' }} />

              <Field label="NEW PASSWORD">
                <PasswordInput
                  value={newPw}
                  onChange={setNewPw}
                  placeholder="Min. 8 characters"
                  show={showNew}
                  onToggleShow={() => setShowNew(v => !v)}
                />
                <StrengthBar password={newPw} />
              </Field>

              <Field label="CONFIRM NEW PASSWORD">
                <PasswordInput
                  value={confirmPw}
                  onChange={setConfirmPw}
                  placeholder="Re-enter new password"
                  show={showConfirm}
                  onToggleShow={() => setShowConfirm(v => !v)}
                />
                {confirmPw && confirmPw !== newPw && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#EF4444', fontFamily: 'DM Sans, sans-serif' }}>
                    Passwords do not match
                  </p>
                )}
                {confirmPw && confirmPw === newPw && newPw.length >= 8 && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Passwords match
                  </p>
                )}
              </Field>

              {pwError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#DC2626', fontFamily: 'DM Sans, sans-serif',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {pwError}
                </div>
              )}

              <div style={{ paddingTop: 4 }}>
                <PrimaryButton
                  onClick={handleChangePw}
                  disabled={!currentPw || !newPw || !confirmPw || newPw !== confirmPw}
                  loading={saving}
                >
                  {saving ? 'Verifying…' : 'UPDATE PASSWORD'}
                </PrimaryButton>
              </div>

              {/* Session info */}
              <InfoBox rows={[
                { label: 'Signed in as', value: userEmail },
                { label: 'Last active',  value: profile?.last_active_at ? fmtDateTime(profile.last_active_at) : 'Just now' },
                { label: 'Member since', value: profile?.created_at ? fmtDate(profile.created_at) : '—' },
              ]} />
            </div>
          )}

        
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}