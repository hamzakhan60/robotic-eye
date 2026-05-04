// src/components/shared/LiveClock.tsx
'use client'
import { useEffect, useState } from 'react'

export function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-2xl font-bold text-slate-100 tracking-widest">
      {time}
    </span>
  )
}
