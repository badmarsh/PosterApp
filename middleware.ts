import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // NOTE: All API routes require auth. Frontend injects Bearer token via fetch interceptor in page.tsx.

  // Bypass auth for assets since <img> tags cannot send Authorization headers
  if (request.nextUrl.pathname.match(/^\/api\/workspaces\/[^\/]+\/assets\//)) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.AUTH_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
// TODO: Replace with proper session-based auth (Clerk/Supabase) before multi-user deployment
