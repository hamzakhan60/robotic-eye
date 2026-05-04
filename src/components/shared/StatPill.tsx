// src/components/shared/StatPill.tsx
interface StatPillProps {
  label: string
  value: string | number
  color?: 'default' | 'green' | 'amber' | 'red'
}

export function StatPill({ label, value, color = 'default' }: StatPillProps) {
  const colors = {
    default: 'bg-slate-800 text-slate-300',
    green:   'bg-emerald-900/40 text-emerald-400',
    amber:   'bg-amber-900/40 text-amber-400',
    red:     'bg-red-900/40 text-red-400',
  }
  return (
    <div className={`px-3 py-1.5 rounded-md text-sm ${colors[color]}`}>
      <span className="text-slate-500 mr-2">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  )
}


