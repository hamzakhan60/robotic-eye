// src/components/operator/SuccessFlash.tsx
'use client'
import { useEffect } from 'react'
import { useOperatorStore } from '@/stores/operatorStore'

export function SuccessFlash() {
  const { successData, clearSuccess } = useOperatorStore()

  useEffect(() => {
    if (!successData) return
    const t = setTimeout(clearSuccess, 2800)
    return () => clearTimeout(t)
  }, [successData])

  if (!successData) return null

  const isReturn = successData.type === 'return'

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:400,
      background: isReturn ? 'rgba(5,150,105,0.96)' : 'rgba(37,99,235,0.96)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'DM Sans, sans-serif',
      animation:'fadeIn 0.2s ease',
      padding: '24px 16px',
      boxSizing: 'border-box',
    }}>
      <div style={{ textAlign:'center', animation:'scaleIn 0.2s ease', width:'100%', maxWidth:480 }}>

        {/* Check circle */}
        <div style={{
          width:72, height:72, borderRadius:36,
          background:'rgba(255,255,255,0.2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 24px',
          border:'2px solid rgba(255,255,255,0.4)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>

        <h1 className="sf-title" style={{
          fontWeight:700, color:'white',
          letterSpacing:'0.04em', margin:'0 0 12px',
        }}>
          {isReturn ? 'WEIGHING COMPLETE' : 'ENTRY RECORDED'}
        </h1>

        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          gap:10, marginBottom:20, flexWrap:'wrap',
        }}>
          <span style={{
            background:'rgba(255,255,255,0.2)', borderRadius:6,
            padding:'4px 12px', fontFamily:'DM Mono, monospace',
            fontSize:15, color:'white', fontWeight:600,
          }}>
            {successData.tokenNumber}
          </span>
          <span className="sf-plate" style={{
            fontWeight:700, color:'white',
            fontFamily:'DM Mono, monospace', letterSpacing:'0.08em',
          }}>
            {successData.plate}
          </span>
        </div>

        {isReturn ? (
          <div>
            <div className="sf-sub" style={{
              color:'rgba(255,255,255,0.75)', marginBottom:12,
            }}>
              Loaded: {successData.loadedKg?.toLocaleString()} kg
              {' · '}
              Empty: {successData.emptyKg?.toLocaleString()} kg
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)',
                          letterSpacing:'0.1em', marginBottom:8 }}>
              NET LOAD
            </div>
            <div className="sf-net" style={{
              fontWeight:800, color:'white',
              fontFamily:'DM Mono, monospace', letterSpacing:'-0.02em',
            }}>
              {successData.netLoadKg?.toLocaleString()}
              <span className="sf-net-unit" style={{ marginLeft:8, fontWeight:600 }}>kg</span>
            </div>
          </div>
        ) : (
          <div className="sf-entry-weight" style={{
            color:'rgba(255,255,255,0.9)',
            fontFamily:'DM Mono, monospace', fontWeight:600,
          }}>
            {successData.weightKg?.toLocaleString()} kg
          </div>
        )}

        <div style={{ marginTop:24, fontSize:12, color:'rgba(255,255,255,0.4)',
                      letterSpacing:'0.08em' }}>
          AUTO-CLOSING
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 }            to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.92) } to { transform: scale(1) } }

        /* Desktop defaults */
        .sf-title        { font-size: 28px; }
        .sf-plate        { font-size: 22px; }
        .sf-sub          { font-size: 15px; }
        .sf-net          { font-size: 52px; }
        .sf-net-unit     { font-size: 24px; }
        .sf-entry-weight { font-size: 24px; }

        /* Tablet (≤ 600px) */
        @media (max-width: 600px) {
          .sf-title        { font-size: 22px; }
          .sf-plate        { font-size: 18px; }
          .sf-sub          { font-size: 13px; }
          .sf-net          { font-size: 40px; }
          .sf-net-unit     { font-size: 20px; }
          .sf-entry-weight { font-size: 20px; }
        }

        /* Mobile (≤ 380px) */
        @media (max-width: 380px) {
          .sf-title        { font-size: 18px; }
          .sf-plate        { font-size: 16px; }
          .sf-sub          { font-size: 12px; }
          .sf-net          { font-size: 34px; }
          .sf-net-unit     { font-size: 16px; }
          .sf-entry-weight { font-size: 18px; }
        }
      `}</style>
    </div>
  )
}