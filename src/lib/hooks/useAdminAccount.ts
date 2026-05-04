// lib/hooks/useAdminAccount.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface AdminProfile {
  id: string
  name: string
  employee_id: string
  role: string
  is_active: boolean
  phone: string | null
  avatar_url: string | null
  last_active_at: string | null
  created_at: string
  auth_user_id: string | null
  notification_prefs: NotifPrefs | null
}

export interface NotifPrefs {
  inApp: boolean
  browserPush: boolean
  soundAlerts: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  inApp: true,
  browserPush: false,
  soundAlerts: true,
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useAdminAccount() {
  const supabase = getClient()

  const [profile,        setProfile]        = useState<AdminProfile | null>(null)
  const [userEmail,      setUserEmail]       = useState('')
  const [loading,        setLoading]         = useState(true)
  const [saving,         setSaving]          = useState(false)
  const [uploadingPhoto, setUploadingPhoto]  = useState(false)
  const [error,          setError]           = useState<string | null>(null)
  const [successMsg,     setSuccessMsg]      = useState<string | null>(null)
  const [pushPermission, setPushPermission]  = useState<NotificationPermission>('default')

  // Clear banners after 3.5 s
  const showSuccess = (msg: string) => {
    setError(null)
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }
  const showError = (msg: string) => {
    setSuccessMsg(null)
    setError(msg)
    setTimeout(() => setError(null), 5000)
  }

  // ── Load ─────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setLoading(true)
    const { data: { session }, error: sessErr } = await supabase.auth.getSession()
    if (sessErr || !session) { setLoading(false); return }

    setUserEmail(session.user.email ?? '')

    const { data, error: dbErr } = await supabase
      .from('operators')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single()

    if (dbErr) {
      showError(dbErr.message)
    } else {
      setProfile(data as AdminProfile)
    }

    if (typeof Notification !== 'undefined') {
      setPushPermission(Notification.permission)
    }

    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadProfile() }, [loadProfile])

  // Refresh last_active_at on mount
  useEffect(() => {
    const updateActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase
        .from('operators')
        .update({ last_active_at: new Date().toISOString() })
        .eq('auth_user_id', session.user.id)
    }
    updateActivity()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update profile ───────────────────────────────────────────
  const updateProfile = async (name: string, phone: string) => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('operators')
      .update({ name, phone: phone || null })
      .eq('id', profile.id)

    if (error) {
      showError(error.message)
    } else {
      setProfile(prev => prev ? { ...prev, name, phone: phone || null } : prev)
      showSuccess('Profile updated successfully')
    }
    setSaving(false)
  }

  // ── Change password ──────────────────────────────────────────
  // Supabase doesn't expose "verify current password" directly —
  // we re-sign-in with email + current password first to validate it.
  const changePassword = async (currentPw: string, newPw: string): Promise<boolean> => {
    setSaving(true)
    // Step 1: verify current password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPw,
    })
    if (signInErr) {
      showError('Current password is incorrect')
      setSaving(false)
      return false
    }
    // Step 2: update to new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
    if (updateErr) {
      showError(updateErr.message)
      setSaving(false)
      return false
    }
    showSuccess('Password changed successfully')
    setSaving(false)
    return true
  }

  // ── Upload avatar ────────────────────────────────────────────
  const uploadAvatar = async (file: File) => {
    if (!profile) return
    setUploadingPhoto(true)

    // Validate
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file')
      setUploadingPhoto(false)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be under 5 MB')
      setUploadingPhoto(false)
      return
    }

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${profile.id}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      showError(`Upload failed: ${upErr.message}`)
      setUploadingPhoto(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    // bust cache
    const bustedUrl = `${publicUrl}?t=${Date.now()}`

    const { error: dbErr } = await supabase
      .from('operators')
      .update({ avatar_url: bustedUrl })
      .eq('id', profile.id)

    if (dbErr) {
      showError(dbErr.message)
    } else {
      setProfile(prev => prev ? { ...prev, avatar_url: bustedUrl } : prev)
      showSuccess('Profile photo updated')
    }

    setUploadingPhoto(false)
  }

  // ── Remove avatar ────────────────────────────────────────────
  const removeAvatar = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('operators')
      .update({ avatar_url: null })
      .eq('id', profile.id)

    if (error) {
      showError(error.message)
    } else {
      setProfile(prev => prev ? { ...prev, avatar_url: null } : prev)
      showSuccess('Profile photo removed')
    }
    setSaving(false)
  }

  // ── Notification prefs ───────────────────────────────────────
  const updateNotifPrefs = async (partial: Partial<NotifPrefs>) => {
    if (!profile) return
    const current = profile.notification_prefs ?? DEFAULT_PREFS
    const updated: NotifPrefs = { ...current, ...partial }

    // Optimistic update
    setProfile(prev => prev ? { ...prev, notification_prefs: updated } : prev)

    const { error } = await supabase
      .from('operators')
      .update({ notification_prefs: updated })
      .eq('id', profile.id)

    if (error) {
      // Roll back
      setProfile(prev => prev ? { ...prev, notification_prefs: current } : prev)
      showError('Failed to save notification preference')
    }
  }

  // ── Request browser push ──────────────────────────────────────
  const requestBrowserPush = async () => {
    if (typeof Notification === 'undefined') {
      showError('Browser notifications are not supported in this browser')
      return
    }
    const perm = await Notification.requestPermission()
    setPushPermission(perm)
    if (perm === 'granted') {
      await updateNotifPrefs({ browserPush: true })
      showSuccess('Browser push notifications enabled')
    } else {
      showError('Permission denied — please enable notifications in your browser settings')
    }
  }

  return {
    profile,
    userEmail,
    loading,
    saving,
    uploadingPhoto,
    error,
    successMsg,
    pushPermission,
    notifPrefs: profile?.notification_prefs ?? DEFAULT_PREFS,
    updateProfile,
    changePassword,
    uploadAvatar,
    removeAvatar,
    updateNotifPrefs,
    requestBrowserPush,
    reload: loadProfile,
  }
}