// src/app/(operator)/notifications/page.tsx
'use client'
import { useNotifications, type Notification } from '@/lib/hooks/useNotifications'
import { Bell, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

function getStyle(type: string) {
  switch (type) {
    case 'vehicle_detected':
    case 'new_detection':
      return { icon: <Bell className="w-5 h-5 text-blue-600" />,
               border: '#3B82F6', iconBg: '#EFF6FF' }
    case 'entry_confirmed':
    case 'return_confirmed':
    case 'weight_confirmed':
      return { icon: <CheckCircle className="w-5 h-5 text-green-600" />,
               border: '#10B981', iconBg: '#F0FDF4' }
    case 'anomaly':
    case 'anomaly_flagged':
    case 'alert':
      return { icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
               border: '#F59E0B', iconBg: '#FFFBEB' }
    case 'dismissed':
    case 'detection_dismissed':
      return { icon: <XCircle className="w-5 h-5 text-red-500" />,
               border: '#EF4444', iconBg: '#FEF2F2' }
    default:
      return { icon: <Bell className="w-5 h-5 text-blue-600" />,
               border: '#3B82F6', iconBg: '#EFF6FF' }
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date))     return formatDistanceToNow(date, { addSuffix: true })
  if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`
  return format(date, 'MMM d · h:mm a')
}

function NotifCard({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const s = getStyle(notif.type)
  return (
    <div
      onClick={() => !notif.is_read && onRead(notif.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 18px',
        background: notif.is_read ? 'white' : '#F8FBFF',
        borderRadius: 10,
        border: '1px solid #E2E8F0',
        borderLeft: `4px solid ${s.border}`,
        cursor: notif.is_read ? 'default' : 'pointer',
        opacity: notif.is_read ? 0.75 : 1,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        if (!notif.is_read)
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 40, height: 40, borderRadius: 20, flexShrink: 0,
        background: s.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {s.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: 12 }}>
          <span style={{
            fontSize: 14, fontWeight: notif.is_read ? 500 : 600,
            color: notif.is_read ? '#64748B' : '#0F172A',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {notif.title}
          </span>
          <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap',
                         flexShrink: 0, fontFamily: 'DM Mono, monospace' }}>
            {formatTime(notif.created_at)}
          </span>
        </div>
        {notif.body && (
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 3,
                      fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
            {notif.body}
          </p>
        )}
      </div>

      {/* Unread dot */}
      {!notif.is_read && (
        <div style={{ width: 8, height: 8, borderRadius: 4,
                      background: '#2563EB', flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  )
}

export default function NotificationsPage() {
  const { groups, loading, error, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  return (
    // KEY FIX: flex-1 + overflow-y-auto — fits inside operator layout
    <div style={{ flex: 1, overflowY: 'auto', background: '#F8F9FA' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A',
                         fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 4,
                          fontFamily: 'DM Sans, sans-serif' }}>
                {unreadCount} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              style={{ fontSize: 13, fontWeight: 600, color: '#2563EB',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif' }}>
              Mark all read
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13,
                        color: '#DC2626', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 76, borderRadius: 10,
                                    background: '#F1F5F9',
                                    animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 32,
                          background: '#F1F5F9', margin: '0 auto 16px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell className="w-7 h-7 text-slate-400" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#64748B',
                        fontFamily: 'DM Sans, sans-serif' }}>
              No notifications yet
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 6,
                        fontFamily: 'DM Sans, sans-serif' }}>
              Vehicle detections and confirmations will appear here
            </p>
          </div>
        )}

        {/* Grouped list */}
        {!loading && groups.map(group => (
          <div key={group.label} style={{ marginBottom: 32 }}>
            {/* Group label */}
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
              color: '#94A3B8', marginBottom: 12, paddingLeft: 4,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {group.label.toUpperCase()}
            </div>
            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.items.map(notif => (
                <NotifCard key={notif.id} notif={notif} onRead={markAsRead} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}