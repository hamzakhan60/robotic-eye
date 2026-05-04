// src/lib/hooks/useAccount.ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export interface NotificationPrefs {
  inApp: boolean
  browserPush: boolean
  soundAlerts: boolean
}

export interface OperatorProfile {
  id: string
  name: string
  employee_id: string
  role: string
  is_active: boolean
  phone: string | null
  avatar_url: string | null
  created_at: string
  last_active_at: string | null
  auth_user_id: string | null
  notification_prefs: NotificationPrefs | null
}

const DEFAULT_PREFS: NotificationPrefs = {
  inApp: true,
  browserPush: false,
  soundAlerts: true,
}

export function useAccount() {
  const { user } = useAuth()
  const supabase = getClient()

  const [profile, setProfile] = useState<OperatorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  // Check browser push permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  // Fetch operator profile (includes notification_prefs column)
  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setProfile(data)
        // Load prefs from DB, fallback to defaults
        setNotifPrefs(data.notification_prefs ?? DEFAULT_PREFS)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  // Update profile (name + phone)
  const updateProfile = useCallback(async (name: string, phone: string) => {
    if (!profile) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('operators')
      .update({ name, phone })
      .eq('id', profile.id)

    if (error) setError(error.message)
    else {
      setProfile(prev => prev ? { ...prev, name, phone } : prev)
      flash('Profile updated successfully')
    }
    setSaving(false)
  }, [profile])

  // Change password — re-authenticates first, then updates
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    setSaving(true)
    setError(null)

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: currentPassword,
    })

    if (signInErr) {
      setError('Current password is incorrect')
      setSaving(false)
      return false
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else flash('Password changed successfully')

    setSaving(false)
    return !error
  }, [user])

  // Upload avatar to Supabase Storage → save URL to operators table
  const uploadAvatar = useCallback(async (file: File) => {
    if (!profile || !user) return
    setSaving(true)
    setError(null)

    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError(uploadErr.message)
      setSaving(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const { error: updateErr } = await supabase
      .from('operators')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (updateErr) setError(updateErr.message)
    else {
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
      flash('Photo updated')
    }
    setSaving(false)
  }, [profile, user])

  // Update notification prefs — saves to DB immediately (optimistic)
  const updateNotifPrefs = useCallback(async (patch: Partial<NotificationPrefs>) => {
    if (!profile) return

    const next = { ...notifPrefs, ...patch }
    setNotifPrefs(next) // optimistic update

    const { error } = await supabase
      .from('operators')
      .update({ notification_prefs: next })
      .eq('id', profile.id)

    if (error) {
      setNotifPrefs(notifPrefs) // revert on failure
      setError('Failed to save notification preferences')
    } else {
      setProfile(prev => prev ? { ...prev, notification_prefs: next } : prev)
    }
  }, [profile, notifPrefs])

  // Request browser push permission
  const requestBrowserPush = useCallback(async () => {
    if (!('Notification' in window)) return

    const result = await Notification.requestPermission()
    setPushPermission(result)

    if (result === 'granted') {
      await updateNotifPrefs({ browserPush: true })
    }
  }, [updateNotifPrefs])

  return {
    profile,
    loading,
    saving,
    error,
    successMsg,
    notifPrefs,
    pushPermission,
    updateProfile,
    changePassword,
    uploadAvatar,
    updateNotifPrefs,
    requestBrowserPush,
    userEmail: user?.email || '',
  }
}