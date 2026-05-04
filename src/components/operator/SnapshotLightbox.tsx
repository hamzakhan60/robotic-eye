// src/components/operator/SnapshotLightbox.tsx
'use client'
import { useEffect } from 'react'

interface Props {
  url:      string
  outdoor:  string | null
  indoor:   string | null
  onClose:  () => void
}

export function SnapshotLightbox({ url, outdoor, indoor, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:300,
        padding:'clamp(16px, 4vw, 40px)',  // ← was: padding:40
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:1200, position:'relative' }}>

        {/* Close */}
        <button onClick={onClose}
          style={{
            position:'absolute',
            top:'clamp(-36px, -6vw, -44px)',  // ← was: top:-44
            right:0,
            background:'rgba(255,255,255,0.1)', border:'none',
            borderRadius:8,
            padding:'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)',  // ← was: padding:'8px 16px'
            color:'white',
            cursor:'pointer',
            fontSize:'clamp(11px, 2vw, 13px)',  // ← was: fontSize:13
            fontFamily:'DM Sans, sans-serif',
            display:'flex', alignItems:'center', gap:6,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          Close (Esc)
        </button>

        {/* Both cameras */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',  // ← was: '1fr 1fr'
          gap:'clamp(10px, 2vw, 16px)',  // ← was: gap:16
        }}>
          {[
            { url: outdoor, label:'PLATE CAMERA' },
            { url: indoor,  label:'SCALE DISPLAY' },
          ].map(({ url: u, label }) => (
            <div key={label}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em',
                            color:'rgba(255,255,255,0.5)', marginBottom:8 }}>
                {label}
              </div>
              <div style={{ borderRadius:10, overflow:'hidden',
                            border:'1px solid rgba(255,255,255,0.1)',
                            background:'#111' }}>
                {u ? (
                  <img src={u} alt={label}
                    style={{ width:'100%', display:'block' }} />
                ) : (
                  <div style={{ aspectRatio:'16/9', display:'flex',
                                alignItems:'center', justifyContent:'center',
                                color:'rgba(255,255,255,0.3)', fontSize:13 }}>
                    No snapshot
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}