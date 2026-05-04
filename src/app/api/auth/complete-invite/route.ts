// app/api/auth/complete-invite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── POST /api/auth/complete-invite ────────────────────────────
// Called after the operator has verified their email and fills in
// their name + employee ID. Creates the operators row.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, employee_id, invite_token } = body

    if (!name?.trim())        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!employee_id?.trim()) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    if (!invite_token)        return NextResponse.json({ error: 'Invite token is required' }, { status: 400 })

    // The user must be authenticated (they just clicked the invite link)
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated — please click the invite link again' }, { status: 401 })
    }

    const userToken = authHeader.replace('Bearer ', '')
    const supabase  = getServiceClient()

    // Verify their JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session — please click the invite link again' }, { status: 401 })
    }

    // Look up the invite by token UUID
    const { data: invite, error: inviteError } = await supabase
      .from('operator_invites')
      .select('*')
      .eq('token', invite_token)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: `This invite has already been ${invite.status}` },
        { status: 409 }
      )
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired — ask an admin to send a new one' }, { status: 410 })
    }

    // Check the email matches
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Email mismatch — use the same email the invite was sent to' }, { status: 403 })
    }

    // Check employee_id uniqueness
    const { data: existingEmp } = await supabase
      .from('operators')
      .select('id')
      .eq('employee_id', employee_id.trim())
      .maybeSingle()

    if (existingEmp) {
      return NextResponse.json({ error: 'Employee ID already in use — choose a different one' }, { status: 409 })
    }

    // Check if this auth_user_id already has an operators row
    const { data: existingOp } = await supabase
      .from('operators')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existingOp) {
      // Already set up — just mark invite accepted and redirect
      await supabase
        .from('operator_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
      return NextResponse.json({ success: true, already_exists: true })
    }

    // Create the operators row
    const { data: operator, error: createError } = await supabase
      .from('operators')
      .insert({
        name: name.trim(),
        employee_id: employee_id.trim().toUpperCase(),
        role: invite.role ?? 'operator',
        is_active: true,
        auth_user_id: user.id,
        last_active_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('[complete-invite] create operator error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Mark invite as accepted
    await supabase
      .from('operator_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)

    return NextResponse.json({
      success: true,
      operator: {
        id: operator.id,
        name: operator.name,
        employee_id: operator.employee_id,
        role: operator.role,
      },
    })
  } catch (err: any) {
    console.error('[complete-invite] unexpected error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
