'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isMissingAppAdminsTable } from '@/lib/app-admins'
import {
  isMissingAppSettingsTable,
  normalizeAppSettings,
} from '@/lib/app-settings'
import { createClient } from '@/lib/supabase/server'

const MAX_MATCH_SCORE = 30

export async function saveMatchResult(formData: FormData) {
  const leagueId = (formData.get('league_id') as string | null)?.trim()
  const matchId = (formData.get('match_id') as string | null)?.trim()
  const homeScoreValue = (formData.get('home_score') as string | null)?.trim() ?? ''
  const awayScoreValue = (formData.get('away_score') as string | null)?.trim() ?? ''

  const homeScore = Number.parseInt(homeScoreValue, 10)
  const awayScore = Number.parseInt(awayScoreValue, 10)

  if (!leagueId || !matchId) return { error: 'Partido o liga invalidos.' }
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return { error: 'Ingresa ambos marcadores antes de cerrar el partido.' }
  }
  if (homeScore < 0 || awayScore < 0) return { error: 'Los goles no pueden ser negativos.' }
  if (homeScore > MAX_MATCH_SCORE || awayScore > MAX_MATCH_SCORE) {
    return { error: `Los goles no pueden superar ${MAX_MATCH_SCORE}.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: appAdmin, error: appAdminError },
    { data: match, error: matchError },
    appSettingsResponse,
  ] = await Promise.all([
    supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('matches')
      .select('id, status')
      .eq('id', matchId)
      .single(),
    supabase
      .from('app_settings')
      .select('singleton, allow_result_edits, updated_at, updated_by')
      .eq('singleton', true)
      .maybeSingle(),
  ])

  if (isMissingAppAdminsTable(appAdminError)) {
    return { error: 'Falta crear la tabla de super admins. Aplica el script database/app_admins.sql.' }
  }
  if (appAdminError || !appAdmin) return { error: 'Solo el super admin puede cerrar o corregir resultados.' }
  if (matchError || !match) return { error: 'No encontramos el partido seleccionado.' }

  if (appSettingsResponse.error && !isMissingAppSettingsTable(appSettingsResponse.error)) {
    return { error: 'No se pudieron validar las reglas globales de resultados.' }
  }

  const appSettings = normalizeAppSettings(appSettingsResponse.data)
  if (match.status === 'finished' && !appSettings.allow_result_edits) {
    return { error: 'La edicion de resultados finalizados esta deshabilitada por una regla global.' }
  }

  const { error: updateError } = await supabase
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'finished',
    })
    .eq('id', matchId)

  if (updateError) return { error: 'No se pudo guardar el resultado del partido.' }

  revalidatePath('/leagues/[id]', 'page')
  revalidatePath('/leagues/[id]/admin', 'page')
  revalidatePath('/leagues/[id]/predictions', 'page')
  revalidatePath('/leagues/[id]/results', 'page')

  return { success: true }
}
