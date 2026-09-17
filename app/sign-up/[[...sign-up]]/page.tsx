import { SignUp } from "@clerk/nextjs"
import Link from "next/link"
import { UserX, ArrowRight, ShieldAlert } from "lucide-react"
import { getRegistrationSetting } from "@/lib/system-settings"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SignUpPage() {
  const { allowRegistration } = await getRegistrationSetting()

  if (!allowRegistration) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <UserX className="size-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-3">
            <ShieldAlert className="size-3.5" />
            Registrácia je pozastavená
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Registrácia nových používateľov je uzavretá
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vytváranie nových používateľských účtov je v tomto systéme dočasne obmedzené správcom. Ak už máte vytvorený účet, pokračujte prihlásením.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            (User registration is currently disabled. Existing users can sign in.)
          </p>
          <div className="mt-6">
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "default" }), "w-full gap-2")}
            >
              Prejsť na prihlásenie
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
