import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you were looking for does not exist or has been moved.
      </p>
      <Link href="/" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
        Back to the editor
      </Link>
    </main>
  )
}
