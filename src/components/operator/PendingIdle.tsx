// src/components/operator/PendingIdle.tsx
export function PendingIdle() {
  return (
    <>
      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(1.3); opacity: 0; } }

        .pending-idle-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 400px;
          gap: 16px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 24px 16px;
          box-sizing: border-box;
        }

        /* Shrink min-height on mobile so it doesn't push content off screen */
        @media (max-width: 640px) {
          .pending-idle-root { min-height: 220px; }
        }
      `}</style>

      <div className="pending-idle-root">
        <div style={{ position:'relative' }}>
          <div style={{
            width:80, height:80, borderRadius:40,
            border:'2px solid #E2E8F0',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
              <rect x="2" y="8" width="24" height="14" rx="2"
                stroke="#CBD5E1" strokeWidth="2"/>
              <rect x="26" y="12" width="8" height="10" rx="1"
                stroke="#CBD5E1" strokeWidth="2"/>
              <circle cx="8" cy="24" r="3" stroke="#CBD5E1" strokeWidth="2"/>
              <circle cx="22" cy="24" r="3" stroke="#CBD5E1" strokeWidth="2"/>
            </svg>
          </div>
          <div style={{
            position:'absolute', inset:-6, borderRadius:46,
            border:'2px solid #BFDBFE', opacity:0.6,
            animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite',
          }} />
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:600, color:'#0F172A', marginBottom:4 }}>
            Scale monitor active
          </div>
          <div style={{ fontSize:13, color:'#94A3B8' }}>
            Waiting for vehicle on scale
          </div>
        </div>
      </div>
    </>
  )
}