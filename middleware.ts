import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Protect all API routes except assets
const isApiRoute = createRouteMatcher(['/api(.*)'])
const isPublicRoute = createRouteMatcher([
  '/api/workspaces/(.*)/assets/(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req) && !isPublicRoute(req)) {
    await auth.protect()
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
