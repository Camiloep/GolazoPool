import { redirect } from 'next/navigation'

import JoinInviteLinkForm from '@/components/leagues/JoinInviteLinkForm'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?join=${code}`)
  }

  // Si ya pertenece a la liga, llevarlo directo a ella (sin pasar por el formulario).
  // Admin client: las ligas solo son legibles por sus miembros (RLS).
  const normalizedCode = code.toUpperCase()
  const { data: league } = await createAdminClient()
    .from('leagues')
    .select('id')
    .eq('invite_code', normalizedCode)
    .maybeSingle()

  if (league) {
    const { data: membership } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) redirect(`/leagues/${league.id}`)
  }

  return (
    <div className="brand-stage flex items-center justify-center">
      <div className="brand-panel w-full max-w-sm rounded-panel p-8 text-center">
        <p aria-hidden="true" className="text-4xl">
          🔗
        </p>
        <h1 className="brand-display mt-4 text-2xl font-black text-foreground">Enlace de invitacion</h1>
        <p className="mt-2 text-sm text-muted">Validando tu invitacion...</p>
        <div className="mt-6">
          <JoinInviteLinkForm inviteCode={normalizedCode} />
        </div>
      </div>
    </div>
  )
}
