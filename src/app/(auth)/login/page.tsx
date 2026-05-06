'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'

type Role = 'operator' | 'admin'

// ── Inner component that uses useSearchParams ──
function LoginContent() {
  const [role, setRole]             = useState<Role>('operator')
  const [email, setEmail]           = useState('operator@factory.com')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [resetSent, setResetSent]   = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()  // ✅ now safe inside Suspense

  useEffect(() => {
    if (searchParams.get('error') === 'deactivated') {
      setError('__deactivated__')
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams])

  useEffect(() => {
    setEmail(role === 'operator' ? 'operator@factory.com' : 'admin@factory.com')
    setError(null)
  }, [role])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = getClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const r = data.user?.user_metadata?.role || 'operator'
    router.push(r === 'admin' ? '/overview' : '/dashboard')
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = getClient()
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (resetErr) {
      setError(resetErr.message)
      setLoading(false)
      return
    }
    setResetSent(true)
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 30px #fff inset !important;
          -webkit-text-fill-color: #0F172A !important;
        }

        .login-root {
          display: flex;
          min-height: 100vh;
          width: 100%;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #fff;
        }

        .login-left {
          width: 45%;
          flex-shrink: 0;
          background: #1A1D2E;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          min-height: 100vh;
        }

        .login-left-content {
          position: relative;
          z-index: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          padding: 40px 32px;
        }

        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          padding: 48px 48px;
          min-height: 100vh;
        }

        .login-form-wrap {
          width: 100%;
          max-width: 380px;
        }

        @media (max-width: 900px) {
          .login-left { width: 40%; }
          .login-right { padding: 40px 32px; }
        }

        @media (max-width: 640px) {
          .login-root { flex-direction: column; }
          .login-left { width: 100%; min-height: auto; padding: 40px 24px; }
          .login-left-content { gap: 20px; padding: 0; }
          .login-left-svg { width: 140px !important; height: 58px !important; }
          .login-left-title { font-size: 20px !important; }
          .login-left-sub { font-size: 10px !important; }
          .login-right { flex: none; width: 100%; min-height: auto; padding: 36px 24px 48px; align-items: flex-start; }
          .login-form-wrap { max-width: 100%; }
          .login-brand-mark { margin-bottom: 28px !important; }
        }

        .login-input {
          height: 48px;
          padding: 0 14px;
          border: 1.5px solid #E2E8F0;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #0F172A;
          background: #ffffff;
          outline: none;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .login-input:focus {
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .login-input-pw { padding-right: 44px; }

        .pw-eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #94A3B8;
          padding: 4px;
          line-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .pw-eye-btn:hover { color: #64748B; }

        .login-submit {
          height: 52px;
          background: #2563EB;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          width: 100%;
          transition: background 0.15s;
        }
        .login-submit:disabled { background: #93C5FD; cursor: not-allowed; }
        .login-submit:not(:disabled):hover { background: #1D4ED8; }
      `}</style>

      <div className="login-root">

        {/* ── LEFT PANEL ── */}
        <div className="login-left">
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="grid-cell" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <line x1="40" y1="0" x2="40" y2="40" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                <line x1="0" y1="40" x2="40" y2="40" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-cell)"/>
          </svg>

          <div className="login-left-content">
            <svg className="login-left-svg" width="220" height="90" viewBox="0 0 220 90" fill="none">
              <path
                d="M0 45 L40 45 L58 18 L80 72 L100 10 L122 62 L140 45 L220 45"
                stroke="white" strokeWidth="4.5" strokeLinecap="round"
                strokeLinejoin="round" fill="none"
              />
            </svg>
            <div>
              <div className="login-left-title" style={{
                fontSize: 26, fontWeight: 700, color: '#fff',
                letterSpacing: '0.12em', lineHeight: 1,
              }}>
                ROBOTIC EYE
              </div>
              <div className="login-left-sub" style={{
                fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.2em', marginTop: 6,
              }}>
                SURVEILLANCE SYSTEM
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="login-right">
          <div className="login-form-wrap">

            <div className="login-brand-mark" style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 32,
            }}>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"
                style={{ marginTop: 2, flexShrink: 0 }}>
                <path d="M4 17 L8 17 L12 7 L17 27 L21 3 L25 21 L29 17 L34 17"
                  stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                  color: '#94A3B8', marginBottom: 4,
                }}>
                  ROBOTIC EYE SURVEILLANCE
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                  Sign in to continue
                </div>
              </div>
            </div>

            {error === '__deactivated__' && (
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: '#FFF7ED', border: '1px solid #FED7AA',
                borderRadius: 8, padding: '14px 16px', marginBottom: 24,
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M9 7h2v4H9V7zm0 6h2v2H9v-2z" fill="#EA580C"/>
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z"
                    stroke="#EA580C" strokeWidth="1.5" fill="none"/>
                </svg>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#9A3412', marginBottom: 3 }}>
                    Account Deactivated
                  </div>
                  <div style={{ fontSize: 13, color: '#C2410C', lineHeight: 1.5 }}>
                    Your account has been deactivated. Please contact your administrator to restore access.
                  </div>
                </div>
              </div>
            )}

            {!showForgot && (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Field label="EMAIL">
                  <input
                    className="login-input"
                    type="email"
                    value={email}
                    required
                    onChange={e => setEmail(e.target.value)}
                  />
                </Field>

                <Field label="PASSWORD">
                  <div style={{ position: 'relative' }}>
                    <input
                      className="login-input login-input-pw"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      required
                      placeholder="••••••••"
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pw-eye-btn"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      style={{
                        fontSize: 13, color: '#2563EB', background: 'none',
                        border: 'none', cursor: 'pointer', padding: 0,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                      Forgot password?
                    </button>
                  </div>
                </Field>

                {error && error !== '__deactivated__' && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 6, padding: '10px 14px',
                    fontSize: 13, color: '#DC2626',
                  }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? 'PLEASE WAIT...' : 'SIGN IN'}
                </button>
              </form>
            )}

            {showForgot && !resetSent && (
              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <Field label="EMAIL">
                  <input
                    className="login-input"
                    type="email"
                    value={email}
                    required
                    onChange={e => setEmail(e.target.value)}
                  />
                </Field>

                {error && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 6, padding: '10px 14px',
                    fontSize: 13, color: '#DC2626',
                  }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? 'PLEASE WAIT...' : 'SEND RESET LINK'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  style={{
                    fontSize: 13, color: '#64748B', background: 'none',
                    border: 'none', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", textAlign: 'center',
                  }}>
                  ← Back to sign in
                </button>
              </form>
            )}

            {showForgot && resetSent && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 16, textAlign: 'center', padding: '16px 0',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 32, background: '#EFF6FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M4 9l10 7 10-7" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="4" y="7" width="20" height="14" rx="2" stroke="#2563EB" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#0F172A' }}>
                  Check your inbox
                </div>
                <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                  We sent a reset link to<br/>
                  <strong style={{ color: '#0F172A' }}>{email}</strong>
                </p>
                <button
                  onClick={() => { setShowForgot(false); setResetSent(false) }}
                  style={{
                    fontSize: 13, color: '#64748B', background: 'none',
                    border: 'none', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  ← Back to sign in
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

// ── Outer page — wraps LoginContent in Suspense ──
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

/* ── Sub-components ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.1em', color: '#64748B',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}