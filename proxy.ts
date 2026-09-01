import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Protect every API route. Asset bytes are workspace-private too.
const isApiRoute = createRouteMatcher(['/api(.*)'])

const handler = clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req)) {
    await auth.protect()
  }
  return NextResponse.next()
})

export default function proxy(req: any, ev: any) {
  if (process.env.NEXT_PUBLIC_E2E_TEST === '1' && process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }
  return handler(req, ev)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
