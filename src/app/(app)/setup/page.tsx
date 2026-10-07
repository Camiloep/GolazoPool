import { setupProfile } from '@/actions/profile'
import SetupForm from '@/components/auth/SetupForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, setup_completed')
    .eq('id', user.id)
    .single()

  if (profile?.setup_completed) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="brand-stage flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="text-3xl">👋</p>
            <h1 className="brand-display mt-3 text-3xl font-black text-foreground">Como te llamas?</h1>
            <p className="mt-2 text-sm text-muted">
              Asi te veran los demas en las ligas.
            </p>
          </div>
          <div className="brand-panel rounded-panel p-6">
            <SetupForm action={setupProfile} defaultName={profile?.name ?? ''} />
          </div>
        </div>
      </div>
    </div>
  )
}
