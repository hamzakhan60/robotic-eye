// app/api/admin/invite-operator/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

// ── Service role client ───────────────────────────────────────
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Verify admin ──────────────────────────────────────────────
async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: 'Missing authorization header' }
  const supabase = getServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Invalid or expired token' }
  const { data: op } = await supabase
    .from('operators')
    .select('id, role, name, is_active')
    .eq('auth_user_id', user.id)
    .single()
  if (!op || op.role !== 'admin' || !op.is_active)
    return { error: 'Insufficient permissions — admin role required' }
  return { userId: user.id, adminName: op.name as string }
}

// ── PKT formatter ─────────────────────────────────────────────
function toPKT(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-GB', {
    timeZone:  'Asia/Karachi',
    day:       '2-digit',
    month:     'short',
    year:      'numeric',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    true,
  }) + ' PKT'
}

// ── HTML email template ───────────────────────────────────────
function buildEmailHtml(vars: {
  inviteUrl:      string
  operatorEmail:  string
  invitedByName:  string
  invitedAtPkt:   string
  expiresAtPkt:   string
  appUrl:         string
  supportEmail:   string
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited — Factory Surveillance</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{background-color:#F0F2F5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;color:#0F172A}
    .wrapper{width:100%;background:#F0F2F5;padding:48px 16px}
    .container{max-width:560px;margin:0 auto}
    .brand-bar{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:0 4px}
    .brand-logo{width:36px;height:36px;background:#0F172A;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .brand-name{font-size:14px;font-weight:700;color:#0F172A;letter-spacing:-0.01em}
    .brand-tagline{font-size:11px;color:#94A3B8;margin-top:1px;font-weight:500}
    .card{background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06),0 8px 32px rgba(0,0,0,.07);border:1px solid #E8ECF0}
    .hero{background:#0F172A;padding:36px 40px 32px;position:relative;overflow:hidden}
    .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(37,99,235,.18);border:1px solid rgba(37,99,235,.35);border-radius:20px;padding:4px 12px;margin-bottom:18px}
    .hero-badge-dot{width:6px;height:6px;border-radius:50%;background:#60A5FA;flex-shrink:0}
    .hero-badge-text{font-size:10px;font-weight:700;letter-spacing:.1em;color:#93C5FD}
    .hero-title{font-size:26px;font-weight:700;color:#FFF;line-height:1.25;letter-spacing:-.02em;margin-bottom:10px}
    .hero-sub{font-size:14px;color:#94A3B8;line-height:1.6}
    .body{padding:36px 40px}
    .greeting{font-size:15px;color:#374151;line-height:1.7;margin-bottom:28px}
    .greeting strong{color:#0F172A;font-weight:700}
    .details-card{background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:20px 22px;margin-bottom:28px}
    .details-label{font-size:10px;font-weight:700;letter-spacing:.1em;color:#94A3B8;margin-bottom:14px}
    .detail-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #EEF2F7}
    .detail-row:last-child{border-bottom:none;padding-bottom:0}
    .detail-icon{width:28px;height:28px;border-radius:7px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .detail-key{font-size:11px;font-weight:600;color:#94A3B8;min-width:80px}
    .detail-value{font-size:13px;font-weight:600;color:#0F172A}
    .mono{font-family:'DM Mono','Courier New',monospace;font-size:12px;letter-spacing:.02em}
    .role-badge{display:inline-block;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.08em;padding:3px 9px}
    .cta-wrap{text-align:center;margin-bottom:28px}
    .cta-btn{display:inline-block;background:#2563EB;color:#FFF!important;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.06em;padding:14px 36px;border-radius:9px;box-shadow:0 4px 14px rgba(37,99,235,.35)}
    .expiry-row{display:flex;align-items:center;gap:8px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:28px}
    .expiry-text{font-size:12px;color:#92400E;font-weight:500;line-height:1.5}
    .expiry-text strong{font-weight:700}
    .divider{border:none;border-top:1px solid #F1F5F9;margin:28px 0}
    .section-label{font-size:10px;font-weight:700;letter-spacing:.1em;color:#CBD5E1;margin-bottom:14px}
    .feature-list{display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
    .feature-item{display:flex;align-items:flex-start;gap:10px}
    .feature-check{width:18px;height:18px;border-radius:5px;background:#F0FDF4;border:1px solid #BBF7D0;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .feature-text{font-size:13px;color:#475569;line-height:1.5}
    .feature-text strong{color:#0F172A;font-weight:600}
    .fallback{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:24px}
    .fallback-label{font-size:11px;font-weight:600;color:#94A3B8;margin-bottom:6px;letter-spacing:.05em}
    .fallback-url{font-size:11px;color:#2563EB;font-family:'DM Mono','Courier New',monospace;word-break:break-all;line-height:1.6}
    .security-note{font-size:11px;color:#94A3B8;line-height:1.6;text-align:center}
    .footer{background:#F8FAFC;border-top:1px solid #E8ECF0;padding:24px 40px;text-align:center}
    .footer-logo{display:inline-flex;align-items:center;gap:8px;margin-bottom:12px}
    .footer-logo-box{width:22px;height:22px;background:#0F172A;border-radius:5px;display:inline-flex;align-items:center;justify-content:center}
    .footer-name{font-size:12px;font-weight:700;color:#64748B}
    .footer-text{font-size:11px;color:#94A3B8;line-height:1.7}
    .footer-text a{color:#64748B;text-decoration:none;font-weight:500}
    @media(max-width:600px){.wrapper{padding:24px 12px}.hero{padding:28px 24px 24px}.body{padding:28px 24px}.footer{padding:20px 24px}.hero-title{font-size:22px}}
  </style>
</head>
<body>
<div class="wrapper"><div class="container">

  <div class="brand-bar">
    <div class="brand-logo">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
    <div>
      <div class="brand-name">Factory Surveillance</div>
      <div class="brand-tagline">Weighbridge &amp; Process Monitoring</div>
    </div>
  </div>

  <div class="card">
    <div class="hero">
      <div class="hero-badge"><div class="hero-badge-dot"></div><span class="hero-badge-text">OPERATOR INVITATION</span></div>
      <div class="hero-title">You've been invited<br/>to the portal</div>
      <div class="hero-sub">An admin has added you to the Factory Surveillance system.<br/>Complete your account setup to get started.</div>
    </div>

    <div class="body">
      <p class="greeting">
        Hi there,<br/><br/>
        You've been invited by <strong>${vars.invitedByName}</strong> to join the
        <strong>Factory Surveillance</strong> operator portal. Click the button below
        to accept your invitation and set up your account.
      </p>

      <div class="details-card">
        <div class="details-label">YOUR ACCOUNT DETAILS</div>
        <div class="detail-row">
          <div class="detail-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <span class="detail-key">Email</span>
          <span class="detail-value mono">${vars.operatorEmail}</span>
        </div>
        <div class="detail-row">
          <div class="detail-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <span class="detail-key">Role</span>
          <span class="role-badge">OPERATOR</span>
        </div>
        <div class="detail-row">
          <div class="detail-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <span class="detail-key">Invited</span>
          <span class="detail-value">${vars.invitedAtPkt}</span>
        </div>
        <div class="detail-row">
          <div class="detail-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
            </svg>
          </div>
          <span class="detail-key">Expires</span>
          <span class="detail-value">${vars.expiresAtPkt}</span>
        </div>
      </div>

      <div class="cta-wrap">
        <a href="${vars.inviteUrl}" class="cta-btn">ACCEPT INVITATION →</a>
      </div>

      <div class="expiry-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="expiry-text">This invite link expires in <strong>7 days</strong>. If it expires, contact your admin to send a new one.</span>
      </div>

      <hr class="divider"/>

      <div class="section-label">WHAT YOU'LL HAVE ACCESS TO</div>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-check">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span class="feature-text"><strong>Weighbridge confirmations</strong> — approve or reject inbound &amp; outbound vehicle weighings in real time</span>
        </div>
        <div class="feature-item">
          <div class="feature-check">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span class="feature-text"><strong>Live alerts</strong> — receive and acknowledge critical alerts from pulp overflow, paper cut, and visibility detectors</span>
        </div>
        <div class="feature-item">
          <div class="feature-check">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span class="feature-text"><strong>Shift history</strong> — view a log of all weighings and events from your sessions</span>
        </div>
      </div>

      <hr class="divider"/>

      <div class="fallback">
        <div class="fallback-label">IF THE BUTTON DOESN'T WORK — COPY THIS LINK</div>
        <div class="fallback-url">${vars.inviteUrl}</div>
      </div>

      <p class="security-note">
        If you did not expect this invitation, you can safely ignore this email.<br/>
        The link will expire automatically after 7 days.
      </p>
    </div>

    <div class="footer">
      <div class="footer-logo">
        <div class="footer-logo-box">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span class="footer-name">Factory Surveillance System</span>
      </div>
      <p class="footer-text">
        This is an automated message — please do not reply.<br/>
        Sent from the Weighbridge &amp; Process Monitoring platform.<br/><br/>
        <a href="${vars.appUrl}">Visit Portal</a> &nbsp;·&nbsp;
        <a href="mailto:${vars.supportEmail}">Contact Admin</a>
      </p>
    </div>
  </div>

</div></div>
</body>
</html>`
}

// ── Plain text fallback ───────────────────────────────────────
function buildEmailText(vars: {
  inviteUrl:     string
  operatorEmail: string
  invitedByName: string
  expiresAtPkt:  string
}): string {
  return `
FACTORY SURVEILLANCE — OPERATOR INVITATION
==========================================

You've been invited by ${vars.invitedByName} to join the Factory Surveillance operator portal.

ACCOUNT DETAILS
  Email   : ${vars.operatorEmail}
  Role    : Operator
  Expires : ${vars.expiresAtPkt}

ACCEPT YOUR INVITATION
  ${vars.inviteUrl}

This link expires in 7 days. If it has expired, contact your admin for a new invite.

If you did not expect this email, you can safely ignore it.

— Factory Surveillance System
  `.trim()
}

// ── POST /api/admin/invite-operator ──────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { error: authError, userId, adminName } = await verifyAdmin(req)
    if (authError) return NextResponse.json({ error: authError }, { status: 401 })

    const body                   = await req.json()
    const { email, role = 'operator' } = body

    if (!email || typeof email !== 'string')
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    if (!['operator', 'admin'].includes(role))
      return NextResponse.json({ error: 'role must be operator or admin' }, { status: 400 })

    const supabase = getServiceClient()

    // Check for existing pending invite
    const { data: existing } = await supabase
      .from('operator_invites')
      .select('id, status, expires_at')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      const expired = new Date(existing.expires_at) < new Date()
      if (!expired)
        return NextResponse.json(
          { error: 'A pending invite already exists for this email' },
          { status: 409 }
        )
      await supabase.from('operator_invites').delete().eq('id', existing.id)
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const now       = new Date().toISOString()

    const { data: invite, error: inviteError } = await supabase
      .from('operator_invites')
      .insert({
        email,
        role,
        invited_by: userId,
        status:     'pending',
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (inviteError) {
      console.error('[invite-operator] insert error:', inviteError)
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const redirectTo  = `${appUrl}/auth/accept-invite`
    const supportEmail = process.env.SUPPORT_EMAIL ?? 'admin@factory.com'

    // Build email content with real variables
    const emailVars = {
      inviteUrl:      redirectTo,          // Supabase will append the token hash
      operatorEmail:  email,
      invitedByName:  adminName ?? 'An admin',
      invitedAtPkt:   toPKT(now),
      expiresAtPkt:   toPKT(expiresAt),
      appUrl,
      supportEmail,
    }

    // Send invite via Supabase Auth (Supabase appends the token to redirectTo)
    const { error: inviteAuthError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invite_id: invite.id,
        role,
      },
    })

    if (inviteAuthError) {
      await supabase.from('operator_invites').delete().eq('id', invite.id)
      console.error('[invite-operator] auth invite error:', inviteAuthError)
      return NextResponse.json(
        { error: `Failed to send invite email: ${inviteAuthError.message}` },
        { status: 500 }
      )
    }

    // ── Optional: send custom branded email via Resend / SendGrid ────────────
    // Supabase sends its own email by default. If you want the branded template,
    // disable Supabase's auth emails in Dashboard → Auth → Email Templates
    // and send manually here:
    //
    // import { Resend } from 'resend'
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from:    'Factory Surveillance <no-reply@yourdomain.com>',
    //   to:      email,
    //   subject: `You've been invited to Factory Surveillance`,
    //   html:    buildEmailHtml(emailVars),
    //   text:    buildEmailText(emailVars),
    // })

    console.info(`[invite-operator] invited ${email} by ${adminName} (${userId})`)

    return NextResponse.json({
      success: true,
      invite: {
        id:         invite.id,
        email:      invite.email,
        role:       invite.role,
        expires_at: invite.expires_at,
      },
    })
  } catch (err: any) {
    console.error('[invite-operator] unexpected error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}