import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
// Self-hosted Geist (npm package) — no Google Fonts fetch at build time, so
// builds are reproducible in air-gapped CI/containers.
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'


export const metadata: Metadata = {
  title: 'Poster Block Studio — tikzposter editor',
  description:
    'Internal editor for structured poster cards compiled into a fixed 3-column tikzposter LaTeX template.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable} bg-background`}
        suppressHydrationWarning
      >
        <body className="font-sans antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            themes={["light", "dark", "vercel", "vercel-dark", "midnight"]}
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider delay={200}>{children}</TooltipProvider>
            <Toaster />
          </ThemeProvider>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </body>
      </html>
    </ClerkProvider>
  )
}
