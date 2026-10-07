'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isMissingAppAdminsTable } from '@/lib/app-admins'
import { isMissingAppSettingsTable } from '@/lib/app-settings'
import { createClient } from '@/lib/supabase/server'

export async function saveAppSettings(formData: FormData) {
  const leagueId = (formData.get('league_id') as string | null)?.trim()
  const allowResultEdits = formData.get('allow_result_edits') === 'on'

  if (!leagueId) return { error: 'Liga invalida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: appAdmin, error: appAdminError } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (isMissingAppAdminsTable(appAdminError)) {
    return { error: 'Falta crear la tabla de super admins. Aplica el script database/app_admins.sql.' }
  }
  if (appAdminError || !appAdmin) {
    return { error: 'Solo el super admin puede editar estas reglas globales.' }
  }

  const { error } = await supabase.from('app_settings').upsert(
    {
      singleton: true,
      allow_result_edits: allowResultEdits,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: 'singleton' }
  )

  if (isMissingAppSettingsTable(error)) {
    return { error: 'Falta crear la tabla de reglas globales. Aplica el script database/app_settings.sql.' }
  }
  if (error) return { error: 'No se pudieron guardar las reglas globales.' }

  revalidatePath('/leagues/[id]/results', 'page')
  revalidatePath(`/leagues/${leagueId}/results`)

  return { success: true }
}
