// src/components/shared/TopBar.tsx
// Matches all screens — clock center, operator right
'use client'
import { LiveClock } from './LiveClock'
import { LogOut } from 'lucide-react'

interface TopBarProps {
  operatorName?: string
  onSignOut?:    () => void
}

export function TopBar({ operatorName = 'OPERATOR-1', onSignOut }: TopBarProps) {
  return (
    <div
      className="h-11 flex items-center justify-between px-6 shrink-0"
      style={{ borderBottom: '1px solid #1e2130' }}
    >
      <div />
      <LiveClock />
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-sm text-[#94a3b8] font-mono tracking-wider">
          {operatorName}
        </span>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="text-[#4a5568] hover:text-[#94a3b8] transition-colors ml-2"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  )
}