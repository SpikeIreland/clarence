import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// MIDDLEWARE — Subdomain Routing
// Routes dataroom.clarencelegal.ai to /dataroom/* pages
// ============================================================================

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  const isDataroom =
    hostname.startsWith('dataroom.') ||
    hostname.startsWith('dataroom-localhost')

  const isAcademy = hostname.startsWith('academy.')

  if (isDataroom) {
    // Don't rewrite if already on a dataroom path, API route, or static asset
    if (
      url.pathname.startsWith('/dataroom') ||
      url.pathname.startsWith('/_next') ||
      url.pathname.startsWith('/api') ||
      url.pathname === '/favicon.ico'
    ) {
      return NextResponse.next()
    }

    // Rewrite: dataroom.clarencelegal.ai/dashboard → /dataroom/dashboard
    url.pathname = `/dataroom${url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (isAcademy) {
    // Don't rewrite if already on an academy path, API route, or static asset
    if (
      url.pathname.startsWith('/academy') ||
      url.pathname.startsWith('/_next') ||
      url.pathname.startsWith('/api') ||
      url.pathname === '/favicon.ico'
    ) {
      return NextResponse.next()
    }

    // Rewrite: academy.clarencelegal.ai/course/slug → /academy/course/slug
    url.pathname = `/academy${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Block direct access to /dataroom/* or /academy/* from the main domain
  if (url.pathname.startsWith('/dataroom') || url.pathname.startsWith('/academy')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
