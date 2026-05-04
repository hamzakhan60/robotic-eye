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

// ── Status values ─────────────────────────────────────────────
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
  const unreadCount = useUnreadCount()
  const dropRef     = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const name     = user?.user_metadata?.full_name ||
                   user?.user_metadata?.name ||
                   user?.email?.split('@')[0]?.replace(/[^a-z]/gi, ' ') || 'Operator'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const statusCfg = STATUS_CONFIG[status]

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
                  background:'#F8F9FA', fontFamily:'DM Sans, sans-serif' }}>

      {/* ── TOP BAR ── */}
      <header style={{
        height:64, background:'#1A1D2E', display:'flex',
        alignItems:'center', padding:'0 24px', gap:16,
        boxShadow:'0 1px 0 rgba(255,255,255,0.06)', flexShrink:0,
        minWidth:0,
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

        {/* Nav */}
        <nav style={{ display:'flex', alignItems:'center', gap:8, marginLeft:16, flexShrink:0 }}>
          <Link href="/dashboard" style={{
            fontSize:12, fontWeight:600, letterSpacing:'0.08em',
            color: pathname === '/dashboard' ? 'white' : 'rgba(255,255,255,0.45)',
            textDecoration:'none', padding:'6px 12px', borderRadius:6,
            background: pathname === '/dashboard' ? 'rgba(255,255,255,0.08)' : 'transparent',
            whiteSpace: 'nowrap',
          }}>
            PENDING
          </Link>
          <Link href="/history" style={{
            fontSize:12, fontWeight:600, letterSpacing:'0.08em',
            color: pathname === '/history' ? 'white' : 'rgba(255,255,255,0.45)',
            textDecoration:'none', padding:'6px 12px', borderRadius:6,
            background: pathname === '/history' ? 'rgba(255,255,255,0.08)' : 'transparent',
            whiteSpace: 'nowrap',
          }}>
            HISTORY
          </Link>
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
                animation: 'ping 1.5s ease-out infinite',
              }} />
            )}
            <div style={{
              position:'absolute', inset:0, borderRadius:'50%',
              background: statusCfg.color,
              boxShadow: status !== 'offline' ? `0 0 6px ${statusCfg.glow}` : 'none',
              transition: 'background 0.4s, box-shadow 0.4s',
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

        {/* Avatar + dropdown */}
        <div ref={dropRef} style={{ position:'relative', flexShrink:0 }}>
          <button onClick={() => setDropOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', gap:10, background:'none',
                     border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:8 }}>
            <div style={{ position:'relative' }}>
              <div style={{
                width:38, height:38, borderRadius:19, background:'#2563EB',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, color:'white',
                outline:`2px solid ${statusCfg.color}`,
                outlineOffset:2,
                transition:'outline-color 0.4s',
              }}>{initials}</div>
            </div>
            <span className="op-user-name" style={{
              fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:500,
              whiteSpace:'nowrap',
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
              boxShadow:'0 4px 16px rgba(0,0,0,0.12)', width:180, zIndex:100,
              overflow:'hidden',
            }}>
              <div style={{
                padding:'10px 16px', display:'flex', alignItems:'center', gap:8,
                borderBottom:'1px solid #F1F5F9',
              }}>
                <div style={{
                  width:8, height:8, borderRadius:4,
                  background:statusCfg.color, flexShrink:0,
                }} />
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

        /* ── Tablet (≤ 900px) ── */
        @media (max-width: 900px) {
          .op-brand-label { display: none; }
          .op-clock-date  { display: none; }
          .op-status-label { display: none; }
        }

        /* ── Mobile (≤ 600px) ── */
        @media (max-width: 600px) {
          .op-clock { display: none; }
          .op-user-name { display: none; }
          .op-status { display: none; }
        }
      `}</style>
    </div>
  )
}