// src/app/(operator)/account/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useAccount } from '@/lib/hooks/useAccount'
import { Camera, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        on ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          on ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

type Tab = 'profile' | 'security' | 'notifications'

export default function AccountPage() {
  const {
    profile, loading, saving, error, successMsg,
    notifPrefs, pushPermission,
    updateProfile, changePassword, uploadAvatar,
    updateNotifPrefs, requestBrowserPush,
    userEmail,
  } = useAccount()

  const [tab, setTab] = useState<Tab>('profile')
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileInit, setProfileInit] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  if (profile && !profileInit) {
    setName(profile.name)
    setPhone(profile.phone || '')
    setProfileInit(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'OP'

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), 'MMM yyyy')
    : '—'

  const handleSaveProfile = () => updateProfile(name.trim(), phone.trim())

  const handleChangePw = async () => {
    setPwError(null)
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    const ok = await changePassword(currentPw, newPw)
    if (ok) { setCurrentPw(''); setNewPw(''); setConfirmPw('') }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]">

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <a href="/dashboard" className="hover:text-slate-700 transition-colors">Dashboard</a>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-800 font-medium">My Account</span>
        </nav>
      </div>

      {/* Main layout — stacks on mobile, side-by-side on md+ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 flex flex-col md:flex-row gap-6 items-start">

        {/* ── Left card — avatar + identity ── */}
        <div className="w-full md:w-72 md:shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center
                          md:flex-col sm:flex-row sm:text-left sm:items-start sm:gap-6 md:text-center md:items-center">

            {/* Avatar */}
            <div className="relative mb-4 sm:mb-0 md:mb-4 shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-24 h-24 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-2xl md:text-3xl font-bold tracking-wide">{initials}</span>
                </div>
              )}
            </div>

            {/* Identity info */}
            <div className="flex flex-col items-center sm:items-start md:items-center flex-1">
              <h2 className="text-lg font-semibold text-slate-800 mb-0.5">{profile?.name}</h2>
              <p className="text-xs text-slate-500 mb-3 font-mono">
                EMP-{profile?.employee_id?.replace('OP-', '') || '—'}
              </p>

              <span className="px-4 py-1 rounded border border-blue-300 text-blue-700 text-xs font-semibold tracking-wider uppercase mb-3">
                {profile?.role || 'Operator'}
              </span>

              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${profile?.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-0 sm:mb-0 md:mb-0">Member since {memberSince}</p>
            </div>

            {/* Change photo button — full width on all sizes */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) uploadAvatar(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="mt-5 sm:mt-4 md:mt-6 w-full sm:w-full flex items-center justify-center gap-2
                         border border-slate-300 rounded-lg py-2.5 text-sm text-slate-600 font-medium
                         hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              CHANGE PHOTO
            </button>
          </div>
        </div>

        {/* ── Right card — tabs ── */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
              {(['profile', 'security'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 sm:px-8 py-4 text-sm font-semibold uppercase tracking-wider
                              transition-colors relative whitespace-nowrap flex-shrink-0
                    ${tab === t ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t}
                  {tab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Success / error banners */}
            {successMsg && (
              <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200
                              text-green-700 rounded-lg px-4 py-2.5 text-sm">
                <Check className="w-4 h-4 shrink-0" /> {successMsg}
              </div>
            )}
            {error && (
              <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200
                              text-red-600 rounded-lg px-4 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* ── PROFILE TAB ── */}
            {tab === 'profile' && (
              <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm
                               focus:outline-none focus:border-blue-400 transition-colors"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm
                               focus:outline-none focus:border-blue-400 transition-colors"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      value={userEmail}
                      readOnly
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-400 text-sm bg-slate-50 pr-10"
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white
                               font-semibold px-8 py-3 rounded-lg transition-colors text-sm uppercase tracking-wider"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* ── SECURITY TAB ── */}
            {tab === 'security' && (
              <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm
                                 focus:outline-none focus:border-blue-400 transition-colors pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-800 text-sm
                                 focus:outline-none focus:border-blue-400 transition-colors pr-10"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPw.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            newPw.length >= i * 3
                              ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-amber-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-500'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      className={`w-full border rounded-lg px-4 py-3 text-slate-800 text-sm
                                 focus:outline-none transition-colors pr-10 ${
                                   confirmPw && confirmPw !== newPw
                                     ? 'border-red-300 focus:border-red-400'
                                     : 'border-slate-200 focus:border-blue-400'
                                 }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {pwError && (
                  <p className="text-red-500 text-sm flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> {pwError}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleChangePw}
                    disabled={saving || !currentPw || !newPw || !confirmPw}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white
                               font-semibold px-8 py-3 rounded-lg transition-colors text-sm uppercase tracking-wider"
                  >
                    {saving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}