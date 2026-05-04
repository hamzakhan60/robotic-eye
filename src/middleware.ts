// src/middleware.ts
// Protects all routes — redirects unauthenticated users to login
// Redirects based on role: operator → /dashboard, admin → /overview

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ── Public routes — no auth needed, pass straight through ──
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/')
  ) {
    if (pathname.startsWith('/login') && user) {
      // Already logged in — check is_active before redirecting
      const { data: op } = await supabase
        .from('operators')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single()

      if (!op || !op.is_active) {
        // Deactivated — force sign out and show error on login page
        await supabase.auth.signOut()
        const url = new URL('/login', request.url)
        url.searchParams.set('error', 'deactivated')
        const res = NextResponse.redirect(url)
        // Clear all auth cookies so the signOut sticks
        request.cookies.getAll().forEach(c => res.cookies.delete(c.name))
        return res
      }

      const dest = op.role === 'admin' ? '/overview' : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // ── Root — redirect based on role ──────────────────────────
  if (pathname === '/') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const { data: op } = await supabase
      .from('operators')
      .select('role, is_active')
      .eq('auth_user_id', user.id)
      .single()

    if (!op || !op.is_active) {
      await supabase.auth.signOut()
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'deactivated')
      const res = NextResponse.redirect(url)
      request.cookies.getAll().forEach(c => res.cookies.delete(c.name))
      return res
    }

    const dest = op.role === 'admin' ? '/overview' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── Protected routes — must be logged in ───────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── is_active check on every protected request ──────────────
  // Even if the user has a valid JWT session, if an admin has
  // deactivated them the DB will show is_active = false and they
  // get signed out on their very next page navigation.
  const { data: op } = await supabase
    .from('operators')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single()

  if (!op || !op.is_active) {
    await supabase.auth.signOut()
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'deactivated')
    const res = NextResponse.redirect(url)
    request.cookies.getAll().forEach(c => res.cookies.delete(c.name))
    return res
  }

  // ── Role protection ─────────────────────────────────────────
  // Use DB role (op.role) — more reliable than user_metadata
  const role = op.role ?? 'operator'

  const isAdminRoute = (
    pathname.startsWith('/overview')    ||
    pathname.startsWith('/weighings')   ||
    pathname.startsWith('/weighbridge') ||
    pathname.startsWith('/reports')     ||
    pathname.startsWith('/alerts')      ||
    pathname.startsWith('/operators')
  )
  const isOperatorRoute = pathname.startsWith('/dashboard')

  if (isAdminRoute && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (isOperatorRoute && role === 'admin') {
    return NextResponse.redirect(new URL('/overview', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}