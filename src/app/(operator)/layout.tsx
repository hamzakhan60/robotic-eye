// src/app/(operator)/layout.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'
import Link from 'next/link'

function PulseLogo() {
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
      <path d="M0 10 L6 10 L9 3 L13 17 L16 1 L19 14 L22 10 L32 10"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function LiveClock() {
  const [t, setT] = useState('')
  const [d, setD] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setT(now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))
      setD(now.toLocaleDateString('en-GB', { weekday:'short', month:'short', day:'numeric', year:'numeric' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="op-clock" style={{ display:'flex', alignItems:'center', gap:16 }}>
      <span className="op-clock-date" style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontFamily:'DM Sans, sans-serif' }}>{d}</span>
      <span style={{ fontSize:18, fontWeight:600, color:'white', fontFamily:'DM Mono, monospace', letterSpacing:'0.04em' }}>{t}</span>
    </div>
  )
}

type SystemStatus = 'active' | 'idle' | 'offline'

const STATUS_CONFIG: Record<SystemStatus, { color: string; glow: string; label: string }> = {
  active:  { color: '#10B981', glow: '#10B981', label: 'SYSTEM ACTIVE' },
  idle:    { color: '#F59E0B', glow: '#F59E0B', label: 'SYSTEM IDLE'   },
  offline: { color: '#64748B', glow: 'transparent', label: 'OFFLINE'   },
}

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const [user,       setUser]       = useState<any>(null)
  const [status,     setStatus]     = useState<SystemStatus>('offline')
  const [dropOpen,   setDropOpen]   = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const unreadCount = useUnreadCount()
  const dropRef     = useRef<HTMLDivElement>(null)
  const menuRef     = useRef<HTMLDivElement>(null)
  const router      = useRouter()
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now() }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(ev => window.addEventListener(ev, updateActivity, { passive: true }))
    return () => events.forEach(ev => window.removeEventListener(ev, updateActivity))
  }, [])

  useEffect(() => {
    const supabase = getClient()
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setStatus('offline'); return }
      const idleMs = Date.now() - lastActivityRef.current
      setStatus(idleMs < 5 * 60 * 1000 ? 'active' : 'idle')
    }
    checkStatus()
    const interval = setInterval(checkStatus, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const supabase = getClient()
    const heartbeat = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase
        .from('operators')
        .update({ last_active_at: new Date().toISOString() })
        .eq('auth_user_id', session.user.id)
    }
    heartbeat()
    const interval = setInterval(heartbeat, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const supabase = getClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setStatus('offline'); setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user); setStatus('active')
      }
    })
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [])

  const signOut = async () => {
    const supabase = getClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from('operators')
        .update({ last_active_at: null })
        .eq('auth_user_id', session.user.id)
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  const name      = user?.user_metadata?.full_name ||
                    user?.user_metadata?.name ||
                    user?.email?.split('@')[0]?.replace(/[^a-z]/gi, ' ') || 'Operator'
  const initials  = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const pathname  = typeof window !== 'undefined' ? window.location.pathname : ''
  const statusCfg = STATUS_CONFIG[status]

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
                  background:'#F8F9FA', fontFamily:'DM Sans, sans-serif' }}>

      {/* ── TOP BAR ── */}
      <header style={{
        height:64, background:'#1A1D2E', display:'flex',
        alignItems:'center', padding:'0 16px', gap:12,
        boxShadow:'0 1px 0 rgba(255,255,255,0.06)', flexShrink:0,
        minWidth:0, position:'relative',
      }}>

        {/* Logo + brand */}
        <div className="op-brand" style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <PulseLogo />
          <span className="op-brand-label" style={{
            fontSize:12, fontWeight:600, color:'white', letterSpacing:'0.12em',
          }}>
            WEIGHBRIDGE TERMINAL
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="op-nav-desktop" style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8, flexShrink:0 }}>
          <Link href="/dashboard" style={{
            fontSize:12, fontWeight:600, letterSpacing:'0.08em',
            color: pathname === '/dashboard' ? 'white' : 'rgba(255,255,255,0.45)',
            textDecoration:'none', padding:'6px 12px', borderRadius:6,
            background: pathname === '/dashboard' ? 'rgba(255,255,255,0.08)' : 'transparent',
            whiteSpace:'nowrap',
          }}>PENDING</Link>
          <Link href="/history" style={{
            fontSize:12, fontWeight:600, letterSpacing:'0.08em',
            color: pathname === '/history' ? 'white' : 'rgba(255,255,255,0.45)',
            textDecoration:'none', padding:'6px 12px', borderRadius:6,
            background: pathname === '/history' ? 'rgba(255,255,255,0.08)' : 'transparent',
            whiteSpace:'nowrap',
          }}>HISTORY</Link>
        </nav>

        {/* Spacer */}
        <div style={{ flex:1, minWidth:0 }} />

        {/* Status indicator */}
        <div className="op-status" style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <div style={{ position:'relative', width:10, height:10 }}>
            {status === 'active' && (
              <div style={{
                position:'absolute', inset:0, borderRadius:'50%',
                background: statusCfg.color, opacity:0.4,
                animation:'ping 1.5s ease-out infinite',
              }} />
            )}
            <div style={{
              position:'absolute', inset:0, borderRadius:'50%',
              background: statusCfg.color,
              boxShadow: status !== 'offline' ? `0 0 6px ${statusCfg.glow}` : 'none',
              transition:'background 0.4s, box-shadow 0.4s',
            }} />
          </div>
          <span className="op-status-label" style={{
            fontSize:12, color:'rgba(255,255,255,0.5)', letterSpacing:'0.06em',
            transition:'color 0.3s', whiteSpace:'nowrap',
          }}>
            {statusCfg.label}
          </span>
        </div>

        {/* Clock */}
        <LiveClock />

        {/* Avatar + dropdown (desktop) */}
        <div ref={dropRef} className="op-avatar-desktop" style={{ position:'relative', flexShrink:0 }}>
          <button onClick={() => setDropOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', gap:10, background:'none',
                     border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:8 }}>
            <div style={{ position:'relative' }}>
              <div style={{
                width:38, height:38, borderRadius:19, background:'#2563EB',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, color:'white',
                outline:`2px solid ${statusCfg.color}`,
                outlineOffset:2, transition:'outline-color 0.4s',
              }}>{initials}</div>
            </div>
            <span className="op-user-name" style={{
              fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:500, whiteSpace:'nowrap',
            }}>
              {name.split(' ')[0]}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {dropOpen && (
            <div style={{
              position:'absolute', top:'calc(100% + 8px)', right:0,
              background:'white', borderRadius:8, border:'1px solid #E2E8F0',
              boxShadow:'0 4px 16px rgba(0,0,0,0.12)', width:180, zIndex:200,
              overflow:'hidden',
            }}>
              <div style={{
                padding:'10px 16px', display:'flex', alignItems:'center', gap:8,
                borderBottom:'1px solid #F1F5F9',
              }}>
                <div style={{ width:8, height:8, borderRadius:4, background:statusCfg.color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:'#64748B', fontWeight:500 }}>
                  {status === 'active' ? 'Online' : status === 'idle' ? 'Idle' : 'Offline'}
                </span>
              </div>
              <Link href="/account"
                style={{ display:'block', padding:'10px 16px', fontSize:14, color:'#0F172A', textDecoration:'none' }}
                onClick={() => setDropOpen(false)}>
                My Account
              </Link>
              <div style={{ height:1, background:'#E2E8F0', margin:'0 12px' }} />
              <button onClick={signOut}
                style={{ display:'block', width:'100%', padding:'10px 16px',
                         fontSize:14, color:'#DC2626', background:'none',
                         border:'none', cursor:'pointer', textAlign:'left',
                         fontFamily:'DM Sans, sans-serif' }}>
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* ── Hamburger (mobile only) ── */}
        <div ref={menuRef} className="op-hamburger" style={{ position:'relative', flexShrink:0 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
            style={{ background:'none', border:'none', cursor:'pointer',
                     padding:8, display:'flex', flexDirection:'column',
                     gap:5, alignItems:'center', justifyContent:'center' }}>
            <span style={{
              display:'block', width:22, height:2, background:'white',
              borderRadius:2, transition:'all 0.2s',
              transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display:'block', width:22, height:2, background:'white',
              borderRadius:2, transition:'all 0.2s',
              opacity: menuOpen ? 0 : 1,
            }} />
            <span style={{
              display:'block', width:22, height:2, background:'white',
              borderRadius:2, transition:'all 0.2s',
              transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }} />
          </button>

          {/* Mobile dropdown menu */}
          {menuOpen && (
            <div style={{
              position:'absolute', top:'calc(100% + 8px)', right:0,
              background:'#1A1D2E', borderRadius:10,
              border:'1px solid rgba(255,255,255,0.1)',
              boxShadow:'0 8px 24px rgba(0,0,0,0.3)',
              width:220, zIndex:200, overflow:'hidden',
            }}>
              {/* User info */}
              <div style={{
                padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)',
                display:'flex', alignItems:'center', gap:10,
              }}>
                <div style={{
                  width:36, height:36, borderRadius:18, background:'#2563EB',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:700, color:'white', flexShrink:0,
                  outline:`2px solid ${statusCfg.color}`, outlineOffset:2,
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'white' }}>
                    {name.split(' ')[0]}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                    <div style={{ width:6, height:6, borderRadius:3, background:statusCfg.color }} />
                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>
                      {status === 'active' ? 'Online' : status === 'idle' ? 'Idle' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nav links */}
              <Link href="/dashboard"
                onClick={() => setMenuOpen(false)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'12px 16px', textDecoration:'none',
                  background: pathname === '/dashboard' ? 'rgba(37,99,235,0.2)' : 'transparent',
                  borderLeft: pathname === '/dashboard' ? '3px solid #2563EB' : '3px solid transparent',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={pathname === '/dashboard' ? 'white' : 'rgba(255,255,255,0.45)'}
                  strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span style={{
                  fontSize:12, fontWeight:600, letterSpacing:'0.08em',
                  color: pathname === '/dashboard' ? 'white' : 'rgba(255,255,255,0.45)',
                }}>PENDING</span>
              </Link>

              <Link href="/history"
                onClick={() => setMenuOpen(false)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'12px 16px', textDecoration:'none',
                  background: pathname === '/history' ? 'rgba(37,99,235,0.2)' : 'transparent',
                  borderLeft: pathname === '/history' ? '3px solid #2563EB' : '3px solid transparent',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={pathname === '/history' ? 'white' : 'rgba(255,255,255,0.45)'}
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
                </svg>
                <span style={{
                  fontSize:12, fontWeight:600, letterSpacing:'0.08em',
                  color: pathname === '/history' ? 'white' : 'rgba(255,255,255,0.45)',
                }}>HISTORY</span>
              </Link>

              <div style={{ height:1, background:'rgba(255,255,255,0.08)', margin:'4px 0' }} />

              <Link href="/account"
                onClick={() => setMenuOpen(false)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'12px 16px', textDecoration:'none',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em',
                               color:'rgba(255,255,255,0.45)' }}>MY ACCOUNT</span>
              </Link>

              <div style={{ height:1, background:'rgba(255,255,255,0.08)', margin:'4px 0' }} />

              <button onClick={() => { setMenuOpen(false); signOut() }}
                style={{ display:'flex', alignItems:'center', gap:10,
                         width:'100%', padding:'12px 16px', background:'none',
                         border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#F87171" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span style={{ fontSize:12, fontWeight:600, letterSpacing:'0.08em', color:'#F87171' }}>
                  SIGN OUT
                </span>
              </button>
            </div>
          )}
        </div>

      </header>

      {/* ── CONTENT ── */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');

        @keyframes ping {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }

        /* Hamburger hidden on desktop, avatar shown */
        .op-hamburger      { display: none; }
        .op-avatar-desktop { display: block; }
        .op-nav-desktop    { display: flex; }

        /* ── Tablet (≤ 900px) ── */
        @media (max-width: 900px) {
          .op-brand-label  { display: none; }
          .op-clock-date   { display: none; }
          .op-status-label { display: none; }
        }

        /* ── Mobile (≤ 600px) ── */
        @media (max-width: 600px) {
          .op-clock          { display: none !important; }
          .op-status         { display: none !important; }
          .op-nav-desktop    { display: none !important; }
          .op-avatar-desktop { display: none !important; }
          .op-hamburger      { display: block !important; }
        }
      `}</style>
    </div>
  )
}