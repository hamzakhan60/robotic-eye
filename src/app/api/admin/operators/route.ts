// app/api/admin/operators/route.ts
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

async function verifyAdmin(req: NextRequest): Promise<{ error?: string; userId?: string }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Missing authorization header' }

  const token = authHeader.replace('Bearer ', '')
  const supabase = getServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Invalid token' }

  const { data: operator } = await supabase
    .from('operators')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single()

  if (!operator || operator.role !== 'admin' || !operator.is_active) {
    return { error: 'Admin role required' }
  }
  return { userId: user.id }
}

// ── GET /api/admin/operators ──────────────────────────────────
// Returns all operators with their invite status
export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await verifyAdmin(req)
    if (authError) return NextResponse.json({ error: authError }, { status: 401 })

    const supabase = getServiceClient()
    const { data: operators, error } = await supabase
      .from('operators')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also fetch pending invites
    const { data: invites } = await supabase
      .from('operator_invites')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({ operators, invites: invites ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

// ── PATCH /api/admin/operators ────────────────────────────────
// Update an operator (name, role, is_active)
export async function PATCH(req: NextRequest) {
  try {
    const { error: authError } = await verifyAdmin(req)
    if (authError) return NextResponse.json({ error: authError }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Whitelist updatable fields
    const allowed = ['name', 'role', 'is_active', 'phone', 'notification_prefs']
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('operators')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ operator: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

// ── DELETE /api/admin/operators ───────────────────────────────
// Deactivate (soft delete) or revoke invite
export async function DELETE(req: NextRequest) {
  try {
    const { error: authError } = await verifyAdmin(req)
    if (authError) return NextResponse.json({ error: authError }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const operatorId = searchParams.get('id')
    const inviteId   = searchParams.get('invite_id')

    const supabase = getServiceClient()

    if (inviteId) {
      // Revoke a pending invite
      const { error } = await supabase
        .from('operator_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, action: 'invite_revoked' })
    }

    if (operatorId) {
      // Soft-delete: deactivate the operator
      const { data, error } = await supabase
        .from('operators')
        .update({ is_active: false })
        .eq('id', operatorId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ operator: data, action: 'deactivated' })
    }

    return NextResponse.json({ error: 'id or invite_id required' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}
