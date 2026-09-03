import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Protect every API route. Asset bytes are workspace-private too.
const isApiRoute = createRouteMatcher(['/api(.*)'])

const handler = clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
  }
  return NextResponse.next()
})

export default async function proxy(req: any, ev: any) {
  if (process.env.NEXT_PUBLIC_E2E_TEST === '1' && process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  const res = await handler(req, ev)

  // Critical guard: If Clerk middleware attempts to redirect an API route (e.g. 307 to /sign-in
  // due to missing session, dev-browser handshake, or auth failure), NEVER return an HTML redirect
  // to API callers! That causes client-side fetch() to follow the redirect and crash with
  // `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
  if (isApiRoute(req) && res && res.status >= 300 && res.status < 400) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  return res
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
