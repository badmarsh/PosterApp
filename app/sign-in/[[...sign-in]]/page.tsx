import { SignIn } from "@clerk/nextjs"
import { ShieldAlert } from "lucide-react"
import { getRegistrationSetting } from "@/lib/system-settings"

export const dynamic = "force-dynamic"

export default async function SignInPage() {
  const { allowRegistration } = await getRegistrationSetting()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {!allowRegistration && (
        <div className="mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning dark:text-warning">
          <ShieldAlert className="size-4 shrink-0" />
          <span>Registrácia nových účtov je pozastavená. Prihláste sa existujúcim účtom.</span>
        </div>
      )}
      <SignIn signUpUrl={allowRegistration ? (process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up") : undefined} />
    </div>
  )
}
