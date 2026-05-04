'use client'
import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { getClient }           from '@/lib/supabase/client'

function getStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'transparent' }
  let score = 0
  if (pwd.length >= 8)           score++
  if (pwd.length >= 12)          score++
  if (/[A-Z]/.test(pwd))         score++
  if (/[0-9]/.test(pwd))         score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { score, label: 'Too weak', color: '#EF4444' }
  if (score <= 2) return { score, label: 'Fair',     color: '#F59E0B' }
  if (score === 3) return { score, label: 'Good',    color: '#3B82F6' }
  return               { score, label: 'Strong',     color: '#10B981' }
}

function EyeIcon({ on }: { on: boolean }) {
  return on ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

const baseInput: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #E2E8F0', borderRadius: 9,
  fontSize: 14, fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#0F172A',
  boxSizing: 'border-box', background: 'white',
  transition: 'border-color 0.15s',
}

type Step = 'verifying' | 'reset_form' | 'submitting' | 'done' | 'error'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [step,     setStep]    = useState<Step>('verifying')
  const [error,    setError]   = useState<string | null>(null)

  // For hash flow (#access_token)
  const [rawAt,    setRawAt]   = useState<string | null>(null)
  const [rawRt,    setRawRt]   = useState<string | null>(null)
  // For PKCE flow (?code=) — session is exchanged on mount
  const [usePkce,  setUsePkce] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [showCfm,  setShowCfm]  = useState(false)

  const strength   = getStrength(password)
  const isDisabled = step === 'submitting'

  // ── On mount: detect which flow Supabase used ─────────────────────────────
  //
  // Supabase sends two different reset link formats depending on your
  // project settings in Dashboard → Auth → URL Configuration:
  //
  //   PKCE flow (default for new projects):
  //     /auth/reset-password?code=3d74e36a-...
  //     Must be exchanged via exchangeCodeForSession()
  //
  //   Implicit flow (older projects):
  //     /auth/reset-password#access_token=eyJ...&type=recovery
  //     Tokens extracted directly from hash
  //
  // We handle both here.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabase   = getClient()
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams   = new URLSearchParams(window.location.hash.substring(1))

    const code = searchParams.get('code')
    const at   = hashParams.get('access_token')
    const rt   = hashParams.get('refresh_token')
    const type = hashParams.get('type')

    // ── PKCE flow: ?code= ─────────────────────────────────────────────────
    if (code) {
      // Exchange the one-time code for a session.
      // After this call, supabase.auth has an active session automatically.
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error: exchErr }) => {
          if (exchErr) {
            setError(
              'This reset link has expired or already been used. ' +
              'Please request a new password reset.'
            )
            setStep('error')
            return
          }
          // Clean the code from URL so refresh doesn't re-use it
          window.history.replaceState(null, '', window.location.pathname)
          setUsePkce(true)
          setStep('reset_form')
        })
      return
    }

    // ── Hash / implicit flow: #access_token= ─────────────────────────────
    if (at && rt && (type === 'recovery' || type === 'invite')) {
      window.history.replaceState(null, '', window.location.pathname)
      setRawAt(at)
      setRawRt(rt)
      setStep('reset_form')
      return
    }

    // ── Nothing found ─────────────────────────────────────────────────────
    setError(
      'This reset link is invalid or has already been used. ' +
      'Please request a new one from the login page.'
    )
    setStep('error')
  }, [])

  // ── Submit new password ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    if (strength.score < 2)   { setError('Password is too weak — add uppercase letters or numbers'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }

    setError(null)
    setStep('submitting')

    try {
      const supabase = getClient()

      if (usePkce) {
        // PKCE flow: session is already active from exchangeCodeForSession()
        // — just call updateUser directly
        const { error: updateErr } = await supabase.auth.updateUser({ password })
        if (updateErr) {
          setError(`Could not update password: ${updateErr.message}`)
          setStep('reset_form')
          return
        }

      } else {
        // Hash / implicit flow: exchange stored tokens first
        if (!rawAt || !rawRt) {
          setError('Session tokens missing — please use the link from your email again.')
          setStep('reset_form')
          return
        }

        const { data: { session }, error: sessErr } =
          await supabase.auth.setSession({
            access_token:  rawAt,
            refresh_token: rawRt,
          })

        if (sessErr || !session) {
          setError('Your reset link has expired. Please request a new password reset.')
          setStep('reset_form')
          return
        }

        const { error: updateErr } = await supabase.auth.updateUser({ password })
        if (updateErr) {
          setError(`Could not update password: ${updateErr.message}`)
          setStep('reset_form')
          return
        }
      }

      setStep('done')
      setTimeout(() => router.replace('/login'), 2000)

    } catch (e: any) {
      setError(e?.message ?? 'Network error — please try again')
      setStep('reset_form')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F0F2F5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: '24px 16px',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 40px 36px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 8px 48px rgba(0,0,0,0.10)',
        border: '1px solid #E2E8F0',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: '#0F172A', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
            Factory Surveillance
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
            Operator Portal
          </div>
        </div>

        {/* VERIFYING */}
        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 40, height: 40,
              border: '3px solid #E2E8F0', borderTopColor: '#2563EB',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: '#64748B', fontSize: 14 }}>
              Verifying reset link...
            </p>
          </div>
        )}

        {/* RESET FORM */}
        {(step === 'reset_form' || step === 'submitting') && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                Set a new password
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Choose a strong password for your account.
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                fontSize: 13, color: '#DC2626', display: 'flex', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* New password */}
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 7,
                }}>
                  <label style={{
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', color: '#64748B',
                  }}>
                    NEW PASSWORD
                  </label>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>min. 8 characters</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    disabled={isDisabled}
                    style={{ ...baseInput, paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer',
                    color: '#94A3B8', padding: 0, lineHeight: 0,
                  }}>
                    <EyeIcon on={showPwd} />
                  </button>
                </div>
                {password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: i <= strength.score
                            ? strength.color : '#E2E8F0',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                    <div style={{
                      fontSize: 11, color: strength.color, fontWeight: 600,
                    }}>
                      {strength.label}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  color: '#64748B', display: 'block', marginBottom: 7,
                }}>
                  CONFIRM PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    type={showCfm ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    disabled={isDisabled}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    style={{
                      ...baseInput, paddingRight: 42,
                      borderColor: confirm && confirm !== password
                        ? '#FCA5A5' : '#E2E8F0',
                    }}
                  />
                  <button type="button" onClick={() => setShowCfm(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer',
                    color: '#94A3B8', padding: 0, lineHeight: 0,
                  }}>
                    <EyeIcon on={showCfm} />
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <div style={{
                    fontSize: 11, color: '#EF4444', marginTop: 5, fontWeight: 500,
                  }}>
                    Passwords do not match
                  </div>
                )}
                {confirm && confirm === password && (
                  <div style={{
                    fontSize: 11, color: '#10B981', marginTop: 5,
                    fontWeight: 500, display: 'flex', gap: 4, alignItems: 'center',
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="#10B981" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Passwords match
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                style={{
                  width: '100%', height: 46, marginTop: 4,
                  background: isDisabled ? '#93C5FD' : '#0F172A',
                  color: 'white', border: 'none', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                }}
              >
                {isDisabled ? (
                  <>
                    <span style={{
                      width: 13, height: 13,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: 'white', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }} />
                    Updating password...
                  </>
                ) : 'SET NEW PASSWORD'}
              </button>
            </div>
          </>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 60, height: 60, background: '#F0FDF4', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              Password updated!
            </div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              Your password has been changed.<br/>
              Redirecting you to login...
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 60, height: 60, background: '#FEF2F2', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              Link invalid
            </div>
            <div style={{
              fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 24,
            }}>
              {error}
            </div>
            <a href="/login" style={{
              fontSize: 13, color: '#2563EB',
              fontWeight: 600, textDecoration: 'none',
            }}>
              Back to login
            </a>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus { border-color: #2563EB !important; }
      `}</style>
    </div>
  )
}