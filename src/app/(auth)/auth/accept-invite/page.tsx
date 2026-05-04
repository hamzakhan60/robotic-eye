'use client'
import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { getClient }           from '@/lib/supabase/client'

type Step = 'verifying' | 'fill_details' | 'submitting' | 'done' | 'error'

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

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748B', fontFamily: 'DM Sans, sans-serif' }}>
        {text}
      </label>
      {hint && <span style={{ fontSize: 10, color: '#94A3B8' }}>{hint}</span>}
    </div>
  )
}

function EyeIcon({ on }: { on: boolean }) {
  return on ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

export default function AcceptInvitePage() {
  const router = useRouter()

  const [step,      setStep]  = useState<Step>('verifying')
  const [error,     setError] = useState<string | null>(null)
  const [userEmail, setEmail] = useState('')
  const [isDevMode, setIsDevMode] = useState(false)

  // Raw tokens from the invite URL hash.
  // We store them here and call setSession() ONCE at submit time —
  // never on mount. This guarantees the one-time token is still valid
  // when we actually need it.
  const [rawAt, setRawAt] = useState<string | null>(null)
  const [rawRt, setRawRt] = useState<string | null>(null)

  // Form fields
  const [name,       setName]       = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [showCfm,    setShowCfm]    = useState(false)

  const strength   = getStrength(password)
  const isDisabled = step === 'submitting'

  useEffect(() => {
    async function init() {
      if (typeof window === 'undefined') return
      const supabase = getClient()

      // ── DEV MODE (?dev=1) ────────────────────────────────────
      if (
        window.location.hostname === 'localhost' &&
        new URLSearchParams(window.location.search).get('dev') === '1'
      ) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setRawAt(session.access_token)
          setRawRt(session.refresh_token)
          setEmail(session.user.email ?? '')
          setIsDevMode(true)
          setStep('fill_details')
        } else {
          setError('[DEV] No session found — log in first, then visit ?dev=1')
          setStep('error')
        }
        return
      }

      // ── REAL INVITE: parse hash ───────────────────────────────
      // Supabase appends: #access_token=...&refresh_token=...&type=invite
      if (window.location.hash.includes('access_token')) {
        const params = new URLSearchParams(window.location.hash.substring(1))
        const at   = params.get('access_token')
        const rt   = params.get('refresh_token')
        const type = params.get('type')

        if (at && rt && type === 'invite') {
          // Clear the hash so a page refresh doesn't try to re-use spent tokens
          window.history.replaceState(null, '', window.location.pathname)

          // Store tokens — NOT calling setSession() here
          setRawAt(at)
          setRawRt(rt)

          // Decode email from JWT payload without touching the Supabase API
          try {
            const payload = JSON.parse(atob(at.split('.')[1]))
            setEmail(payload.email ?? '')
          } catch (_) { /* form still shows, email just won't pre-fill */ }

          setStep('fill_details')
          return
        }
      }

      // ── NOTHING FOUND ─────────────────────────────────────────
      setError(
        'Could not verify your invite link. It may have expired or already been used. ' +
        'Please ask an admin to resend.'
      )
      setStep('error')
    }

    init()
  }, []) // eslint-disable-line

  function validate(): string | null {
    if (!name.trim())        return 'Please enter your full name'
    if (!employeeId.trim())  return 'Please enter your Employee ID'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (strength.score < 2)  return 'Password is too weak — add uppercase letters or numbers'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }

    if (!rawAt || !rawRt) {
      setError('Invite tokens missing — please click the invite link from your email again.')
      return
    }

    setError(null)
    setStep('submitting')

    try {
      const supabase = getClient()

      // ── STEP 1: Create session from invite tokens ─────────────
      // Called exactly ONCE, right before we need it.
      // updateUser() runs immediately after so the session
      // cannot expire between these two calls.
      const { data: { session }, error: sessErr } = await supabase.auth.setSession({
        access_token:  rawAt,
        refresh_token: rawRt,
      })

      if (sessErr || !session) {
        setError('Your invite link has expired. Please ask an admin to resend.')
        setStep('fill_details')
        return
      }

      // ── STEP 2: Update password + save name & employee_id ─────
      // updateUser() sets the password and stores extra fields
      // in auth.users.raw_user_meta_data — all in one call,
      // before any redirect happens.
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: {
          full_name:   name.trim(),
          employee_id: employeeId.trim().toUpperCase(),
        },
      })

      if (updateErr) {
        setError(`Could not update account: ${updateErr.message}`)
        setStep('fill_details')
        return
      }

      // DEV MODE: skip the complete-invite API call
      if (isDevMode) {
        setStep('done')
        return
      }

      // ── STEP 3: Create operator profile via API ───────────────
      // Look up invite token from user metadata if not already set
      let tokenToUse: string | null = null
      const inviteId = session.user?.user_metadata?.invite_id

      if (inviteId) {
        const { data: invite } = await supabase
          .from('operator_invites')
          .select('token, status')
          .eq('id', inviteId)
          .single()

        if (invite?.status === 'accepted') {
          router.replace('/dashboard')
          return
        }
        tokenToUse = invite?.token ?? null
      }

      const res = await fetch('/api/auth/complete-invite', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name:         name.trim(),
          employee_id:  employeeId.trim(),
          invite_token: tokenToUse,
        }),
      })

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        console.error('[complete-invite] Non-JSON response:', res.status, text.slice(0, 300))
        setError(`Server error (${res.status}) — check the console for details`)
        setStep('fill_details')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setStep('fill_details')
        return
      }

      // ── STEP 4: Done — redirect to dashboard ──────────────────
      setStep('done')
      setTimeout(() => router.replace('/dashboard'), 1500)

    } catch (e: any) {
      setError(e?.message ?? 'Network error — please try again')
      setStep('fill_details')
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
        width: '100%', maxWidth: 460,
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Factory Surveillance</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>Operator Portal</div>
        </div>

        {/* Dev mode banner */}
        {isDevMode && step !== 'error' && (
          <div style={{
            background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#92400E',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span>🛠</span>
            <div><strong>DEV MODE</strong> — Using existing session ({userEmail}). API will be skipped.</div>
          </div>
        )}

        {/* VERIFYING */}
        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#2563EB',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: '#64748B', fontSize: 14 }}>Verifying your invite link...</p>
          </div>
        )}

        {/* FILL DETAILS */}
        {(step === 'fill_details' || step === 'submitting') && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                Complete your account
              </div>
              {userEmail && (
                <div style={{ fontSize: 13, color: '#64748B' }}>
                  Setting up account for <strong style={{ color: '#0F172A' }}>{userEmail}</strong>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#DC2626', display: 'flex', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                  strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <Label text="FULL NAME" />
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ali Hassan" disabled={isDisabled} style={baseInput} />
              </div>

              <div>
                <Label text="EMPLOYEE ID" />
                <input value={employeeId} onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                  placeholder="e.g. EMP-005" disabled={isDisabled}
                  style={{ ...baseInput, fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#CBD5E1' }}>
                  CREATE YOUR PASSWORD
                </span>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
              </div>

              <div>
                <Label text="PASSWORD" hint="min. 8 characters" />
                <div style={{ position: 'relative' }}>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Create a strong password" disabled={isDisabled}
                    style={{ ...baseInput, paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, lineHeight: 0,
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
                          background: i <= strength.score ? strength.color : '#E2E8F0',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</div>
                  </div>
                )}
              </div>

              <div>
                <Label text="CONFIRM PASSWORD" />
                <div style={{ position: 'relative' }}>
                  <input value={confirm} onChange={e => setConfirm(e.target.value)}
                    type={showCfm ? 'text' : 'password'}
                    placeholder="Re-enter your password" disabled={isDisabled}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    style={{ ...baseInput, paddingRight: 42, borderColor: confirm && confirm !== password ? '#FCA5A5' : '#E2E8F0' }} />
                  <button type="button" onClick={() => setShowCfm(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, lineHeight: 0,
                  }}>
                    <EyeIcon on={showCfm} />
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 5, fontWeight: 500 }}>
                    Passwords do not match
                  </div>
                )}
                {confirm && confirm === password && (
                  <div style={{ fontSize: 11, color: '#10B981', marginTop: 5, fontWeight: 500, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Passwords match
                  </div>
                )}
              </div>

              <button onClick={handleSubmit} disabled={isDisabled} style={{
                width: '100%', height: 46, marginTop: 4,
                background: isDisabled ? '#93C5FD' : '#0F172A',
                color: 'white', border: 'none', borderRadius: 9,
                fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {isDisabled ? (
                  <>
                    <span style={{
                      width: 13, height: 13,
                      border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block',
                    }} />
                    Setting up your account...
                  </>
                ) : (isDevMode ? 'TEST COMPLETE SETUP' : 'COMPLETE SETUP')}
              </button>
            </div>

            <div style={{
              marginTop: 20, padding: '12px 14px', background: '#F8FAFF',
              borderRadius: 8, border: '1px solid #E8F0FE',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB"
                strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                After setup you can log in anytime using your email and the password you just created.
              </span>
            </div>
          </>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 60, height: 60, background: '#F0FDF4', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              {isDevMode ? 'Dev test passed!' : 'Account ready!'}
            </div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              {isDevMode
                ? 'setSession + updateUser both worked. Real invite flow will work identically.'
                : 'Your account has been set up. Redirecting to the portal...'}
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 60, height: 60, background: '#FEF2F2', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Invite link invalid</div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 24 }}>{error}</div>
            <a href="/login" style={{ fontSize: 13, color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
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