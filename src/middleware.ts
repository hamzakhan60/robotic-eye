// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Skip middleware entirely for auth callbacks ──────────────
  // PKCE ?code= must reach the page component untouched.
  // getUser() in middleware can consume/invalidate the code.
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

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

  // ── Public routes ────────────────────────────────────────────
  if (pathname.startsWith('/login')) {
    if (user) {
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
    return supabaseResponse
  }

  // ── Root ─────────────────────────────────────────────────────
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

  // ── Protected routes ─────────────────────────────────────────
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