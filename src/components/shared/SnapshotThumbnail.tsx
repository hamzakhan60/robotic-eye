// src/components/shared/SnapshotThumbnail.tsx
interface SnapshotProps {
  url:     string | null
  label:   string
  onClick?: () => void
}

export function SnapshotThumbnail({ url, label, onClick }: SnapshotProps) {
  if (!url) {
    return (
      <div className="flex flex-col gap-1">
        <div className="w-full h-28 bg-slate-800 rounded-lg border border-slate-700
                        flex items-center justify-center">
          <span className="text-slate-600 text-xs">No snapshot</span>
        </div>
        <span className="text-xs text-slate-500 text-center">{label}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        className="relative w-full h-28 rounded-lg overflow-hidden border
                   border-slate-700 hover:border-slate-500 transition-colors
                   cursor-pointer group"
      >
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition" />
      </button>
      <span className="text-xs text-slate-500 text-center tracking-wider uppercase">
        {label}
      </span>
    </div>
  )
}
