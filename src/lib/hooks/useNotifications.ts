// src/lib/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { isToday, isYesterday, isThisWeek } from 'date-fns'

export interface Notification {
  id:         string
  user_id:    string
  type:       string
  title:      string
  body:       string | null
  data:       any | null
  is_read:    boolean
  created_at: string
}

export interface NotificationGroup {
  label: string
  items: Notification[]
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = getClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (err) { setError(err.message); setLoading(false); return }
    setNotifications(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()

    // Realtime — new notifications appear instantly
    const supabase = getClient()
    const channel  = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'notifications',
      }, () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const markAsRead = async (id: string) => {
    const supabase = getClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
  }

  const markAllAsRead = async () => {
    const supabase = getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // Group by date
  const groups: NotificationGroup[] = []
  const todayItems     = notifications.filter(n => isToday(new Date(n.created_at)))
  const yesterdayItems = notifications.filter(n => isYesterday(new Date(n.created_at)))
  const weekItems      = notifications.filter(n => {
    const d = new Date(n.created_at)
    return isThisWeek(d) && !isToday(d) && !isYesterday(d)
  })
  const olderItems = notifications.filter(n => {
    const d = new Date(n.created_at)
    return !isThisWeek(d)
  })

  if (todayItems.length)     groups.push({ label: 'Today',      items: todayItems })
  if (yesterdayItems.length) groups.push({ label: 'Yesterday',  items: yesterdayItems })
  if (weekItems.length)      groups.push({ label: 'This Week',  items: weekItems })
  if (olderItems.length)     groups.push({ label: 'Older',      items: olderItems })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return { notifications, groups, loading, error, unreadCount, markAsRead, markAllAsRead, refetch: fetchAll }
}