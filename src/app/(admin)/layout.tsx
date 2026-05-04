// src/app/(admin)/layout.tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState }               from 'react'
import { getClient }              from '@/lib/supabase/client'
import { useAuth }                from '@/lib/hooks/useAuth'

const NAV = [
  { label: 'Overview',   href: '/overview',  icon: OverviewIcon  },
  { label: 'Weighbridge',href: '/weighings', icon: ScaleIcon     },
  { label: 'Alerts',     href: '/alerts',    icon: AlertIcon     },
  { label: 'Operators',  href: '/operators', icon: OpsIcon       },
  { label: 'Reports',    href: '/reports',   icon: ReportIcon    },
]

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname          = usePathname()
  const router            = useRouter()
  const { user }          = useAuth()
  const [showDD, setShowDD] = useState(false)

  const name    = user?.user_metadata?.name || 'Admin'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const handleSignOut = async () => {
    await getClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden',
                  fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0, background: '#1A1D2E',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M2 14 L6 14 L10 5 L14 23 L18 2 L22 17 L26 14 L28 14"
                stroke="white" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round"/>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff',
                            letterSpacing: '0.06em', lineHeight: 1.2 }}>
                ROBOTIC EYE
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)',
                            letterSpacing: '0.14em' }}>
                SURVEILLANCE
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <a key={href} href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px', textDecoration: 'none',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                  borderLeft: active ? '3px solid #ffffff' : '3px solid transparent',
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  transition: 'all 0.12s',
                  position: 'relative',
                }}>
                <Icon active={active} />
                {label}
              </a>
            )
          })}
        </nav>

        {/* User + signout */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px', position: 'relative',
        }}>
          {showDD && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 16, right: 16,
              background: '#252836', border: '1px solid #3A3D4E',
              borderRadius: 8, overflow: 'hidden', marginBottom: 4,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
            }}>
              <button
                onClick={() => router.push('/admin-account')}
                style={{ width: '100%', padding: '11px 14px', background: 'none',
                          border: 'none', color: 'rgba(255,255,255,0.6)',
                          fontSize: 13, textAlign: 'left', cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif' }}>
                My Account
              </button>
              <div style={{ height: 1, background: '#3A3D4E' }} />
              <button onClick={handleSignOut}
                style={{ width: '100%', padding: '11px 14px', background: 'none',
                          border: 'none', color: '#EF4444', fontSize: 13,
                          textAlign: 'left', cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                Sign Out
              </button>
            </div>
          )}

          <button onClick={() => setShowDD(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      gap: 10, padding: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 17, flexShrink: 0,
              background: '#2563EB', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, fontWeight: 700,
              color: 'white',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)',
                            letterSpacing: '0.08em' }}>
                ADMIN
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ── Nav icons ─────────────────────────────────────────────────
function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function ScaleIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 3v18M3 12h18"/>
      <circle cx="12" cy="12" r="9"/>
      <path d="M7 12l3 3 5-5"/>
    </svg>
  )
}
function AlertIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function OpsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
    </svg>
  )
}
function AuditIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}