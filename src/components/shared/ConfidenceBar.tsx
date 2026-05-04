// src/components/shared/ConfidenceBar.tsx
interface ConfidenceBarProps {
  value: number   // 0 to 1
  label?: string
}

export function ConfidenceBar({ value, label }: ConfidenceBarProps) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? 'bg-emerald-500'
              : value >= 0.5 ? 'bg-amber-500'
              : 'bg-red-500'
  return (
    <div className="mt-1">
      <div className="flex justify-between mb-1">
        {label && <span className="text-xs text-slate-500">{label}</span>}
        <span className="text-xs text-slate-500 ml-auto">{pct}%</span>
      </div>
      <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
