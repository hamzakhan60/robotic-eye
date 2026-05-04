// src/components/operator/VehicleOnSiteList.tsx
'use client'
import { formatDistanceToNow } from 'date-fns'

interface Vehicle {
  token_number:  string
  plate_number:  string
  loaded_weight: number
  entry_at:      string
  hours_on_site?: number
}

interface Props {
  vehicles: Vehicle[]
  loading:  boolean
}

export function VehicleOnSiteList({ vehicles, loading }: Props) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }

        /* Vehicle card top row — token + plate side by side */
        .vol-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .vol-card-top-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        /* Plate number */
        .vol-plate {
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          font-family: DM Mono, monospace;
          letter-spacing: 0.06em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Weight */
        .vol-weight {
          font-size: 22px;
          font-weight: 700;
          color: #0F172A;
          font-family: DM Mono, monospace;
          margin-bottom: 6px;
        }

        /* Time row */
        .vol-time-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Footer */
        .vol-footer {
          padding: 12px 24px;
          border-top: 1px solid #E2E8F0;
          background: white;
          font-size: 12px;
          color: #94A3B8;
        }

        /* ── Tablet (≤ 860px) — right panel is narrower ── */
        @media (max-width: 860px) {
          .vol-plate   { font-size: 14px; }
          .vol-weight  { font-size: 18px; }
        }

        /* ── Mobile (≤ 640px) — full width stacked ── */
        @media (max-width: 640px) {
          .vol-plate   { font-size: 15px; }
          .vol-weight  { font-size: 20px; }
          .vol-footer  { padding: 10px 16px; }

          /* Time row: stack on very small screens if needed */
          .vol-time-row {
            flex-wrap: wrap;
            gap: 4px;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding:'20px 24px 16px',
        borderBottom:'1px solid #E2E8F0',
        background:'white',
      }}>
        <div style={{ display:'flex', alignItems:'center',
                      justifyContent:'space-between' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.1em',
                        color:'#94A3B8' }}>
            VEHICLES ON SITE
          </div>
          <div style={{
            background: vehicles.length > 0 ? '#2563EB' : '#F1F5F9',
            color: vehicles.length > 0 ? 'white' : '#94A3B8',
            borderRadius:20, padding:'2px 10px',
            fontSize:13, fontWeight:700,
            fontFamily:'DM Mono, monospace',
          }}>
            {vehicles.length}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:16,
                    display:'flex', flexDirection:'column', gap:10 }}>
        {loading && [1,2].map(i => (
          <div key={i} style={{
            height:90, borderRadius:10, background:'#F1F5F9',
            animation:'pulse 1.5s ease-in-out infinite',
          }} />
        ))}

        {!loading && vehicles.length === 0 && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:200, color:'#CBD5E1', gap:8,
          }}>
            <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
              <rect x="2" y="10" width="26" height="16" rx="2"
                stroke="#CBD5E1" strokeWidth="2"/>
              <rect x="28" y="14" width="10" height="12" rx="1"
                stroke="#CBD5E1" strokeWidth="2"/>
              <circle cx="9" cy="28" r="3" stroke="#CBD5E1" strokeWidth="2"/>
              <circle cx="25" cy="28" r="3" stroke="#CBD5E1" strokeWidth="2"/>
            </svg>
            <span style={{ fontSize:13 }}>No vehicles on site</span>
          </div>
        )}

        {vehicles.map(v => {
          const hours = v.hours_on_site ||
            Math.abs((Date.now() - new Date(v.entry_at).getTime()) / 3600000)
          const timeColor = hours > 8 ? '#DC2626' : hours > 4 ? '#D97706' : '#64748B'
          const entryTime = new Date(v.entry_at).toLocaleTimeString('en-GB',
            { hour:'2-digit', minute:'2-digit' })

          return (
            <div key={v.token_number} style={{
              background:'white', borderRadius:10,
              border:'1px solid #E2E8F0', padding:'14px 16px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {/* Top row */}
              <div className="vol-card-top">
                <div className="vol-card-top-left">
                  <span style={{
                    background:'#EFF6FF', color:'#2563EB',
                    borderRadius:6, padding:'3px 8px',
                    fontSize:11, fontWeight:700,
                    fontFamily:'DM Mono, monospace', letterSpacing:'0.04em',
                    flexShrink: 0,
                  }}>
                    {v.token_number}
                  </span>
                  <span className="vol-plate">
                    {v.plate_number}
                  </span>
                </div>
              </div>

              {/* Weight */}
              <div className="vol-weight">
                {v.loaded_weight?.toLocaleString()}
                <span style={{ fontSize:14, color:'#94A3B8', marginLeft:4,
                               fontWeight:500 }}>kg</span>
              </div>

              {/* Time info */}
              <div className="vol-time-row">
                <span style={{ fontSize:12, color: timeColor, fontWeight:500 }}>
                  {formatDistanceToNow(new Date(v.entry_at))} on site
                  {hours > 4 && ' ⚠'}
                </span>
                <span style={{ fontSize:12, color:'#94A3B8',
                               fontFamily:'DM Mono, monospace' }}>
                  {entryTime}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      <div className="vol-footer">
        <span>Today's vehicles — </span>
        <span style={{ color:'#0F172A', fontWeight:600 }}>
          check History for full records
        </span>
      </div>

    </div>
  )
}