// src/lib/hooks/useUnreadCount.ts
// Lightweight hook — just the count for the bell badge in TopBar
import { useState, useEffect } from 'react'
import { getClient } from '@/lib/supabase/client'

export function useUnreadCount() {
  const [count, setCount] = useState(0)

  const fetch = async () => {
    const supabase = getClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { count: c } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setCount(c || 0)
  }

  useEffect(() => {
    fetch()
    const supabase = getClient()
    const channel  = supabase
      .channel('unread_count')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
      }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return count
}