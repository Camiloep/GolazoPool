'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isMissingAppAdminsTable } from '@/lib/app-admins'
import { createClient } from '@/lib/supabase/server'
import { syncWorldCupFromOpenFootball } from '@/server/openfootball/sync'

type SyncState = {
  error?: string
  success?: boolean
  summary?: {
    updatedMatches: number
    finishedMatches: number
    inProgressMatches: number
    scheduledMatches: number
    warnings: string[]
  }
}

export async function syncOpenFootballMatches(
  _prevState: SyncState | undefined,
  formData: FormData
): Promise<SyncState> {
  const leagueId = (formData.get('league_id') as string | null)?.trim()

  if (!leagueId) {
    return { error: 'No se encontro la liga para sincronizar.' }
  }

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
    return {
      error: 'Falta la tabla app_admins. Aplica el script correspondiente antes de sincronizar.',
    }
  }

  if (appAdminError || !appAdmin) {
    return { error: 'Solo el super admin puede sincronizar el calendario global.' }
  }

  try {
    const summary = await syncWorldCupFromOpenFootball()

    revalidatePath('/leagues/[id]', 'page')
    revalidatePath('/leagues/[id]/admin', 'page')
    revalidatePath('/leagues/[id]/predictions', 'page')
    revalidatePath('/leagues/[id]/results', 'page')
    revalidatePath(`/leagues/${leagueId}`)
    revalidatePath(`/leagues/${leagueId}/admin`)
    revalidatePath(`/leagues/${leagueId}/predictions`)
    revalidatePath(`/leagues/${leagueId}/results`)

    return {
      success: true,
      summary: {
        updatedMatches: summary.updatedMatches,
        finishedMatches: summary.finishedMatches,
        inProgressMatches: summary.inProgressMatches,
        scheduledMatches: summary.scheduledMatches,
        warnings: summary.warnings,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo sincronizar con OpenFootball.'

    return { error: message }
  }
}
