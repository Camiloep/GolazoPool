import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/actions/auth'
import AppHeader from '@/components/layout/AppHeader'
import { MobileNavProvider } from '@/lib/mobile-nav-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const signOutButton = (
    <form action={signOut}>
      <button
        className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
        type="submit"
      >
        Salir
      </button>
    </form>
  )

  return (
    <MobileNavProvider>
      <div className="min-h-screen">
        <AppHeader
          profileName={profile?.name ?? user.email ?? ''}
          signOutButton={signOutButton}
        />
        <main>{children}</main>
      </div>
    </MobileNavProvider>
  )
}
