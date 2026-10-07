'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  formatPredictionLockWindow,
  normalizeLeagueSettings,
  isMissingLeagueSettingsTable,
} from '@/lib/league-settings'
import { getPredictionLockState } from '@/lib/predictions'

export async function saveAndConfirmPrediction(formData: FormData) {
  const matchId = formData.get('match_id') as string
  const leagueId = formData.get('league_id') as string
  const homeScore = parseInt(formData.get('home_score') as string, 10)
  const awayScore = parseInt(formData.get('away_score') as string, 10)

  if (!matchId || !leagueId || isNaN(homeScore) || isNaN(awayScore)) return { error: 'Datos incompletos.' }
  if (homeScore < 0 || awayScore < 0) return { error: 'Los goles no pueden ser negativos.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: membership },
    { data: match },
    settingsResponse,
    { data: existing, error: existingError },
  ] = await Promise.all([
    supabase
      .from('league_members')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('matches')
      .select('starts_at, status, home_team_id, away_team_id')
      .eq('id', matchId)
      .single(),
    supabase
      .from('league_settings')
      .select('league_id, allow_prediction_edits, prediction_lock_minutes, prediction_lock_mode')
      .eq('league_id', leagueId)
      .maybeSingle(),
    supabase
      .from('predictions')
      .select('id, confirmed')
      .eq('user_id', user.id)
      .eq('league_id', leagueId)
      .eq('match_id', matchId)
      .maybeSingle(),
  ])

  if (!membership) return { error: 'Debes pertenecer a la liga para pronosticar.' }
  if (!match) return { error: 'No encontramos el partido seleccionado.' }
  if (existingError) return { error: 'No se pudo validar tu pronostico actual.' }

  // Un cruce a medio definir (un equipo clasificado, rival por definir) no acepta
  // pronostico hasta que esten ambos equipos. Espejo del guard de la tarjeta.
  if (!match.home_team_id || !match.away_team_id) {
    return { error: 'Este partido aun no tiene ambos equipos definidos.' }
  }

  if (settingsResponse.error && !isMissingLeagueSettingsTable(settingsResponse.error)) {
    return { error: 'No se pudo validar la configuracion de bloqueo.' }
  }

  const settings = normalizeLeagueSettings(leagueId, settingsResponse.data)
  const firstMatchResponse =
    settings.prediction_lock_mode === 'tournament_start'
      ? await supabase
          .from('matches')
          .select('starts_at')
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null }

  if (firstMatchResponse.error) return { error: 'No se pudo validar la fecha inicial del mundial.' }

  const lockState = getPredictionLockState({
    startsAt: match.starts_at,
    status: match.status,
    lockMinutes: settings.prediction_lock_minutes,
    lockMode: settings.prediction_lock_mode,
    tournamentStartsAt: firstMatchResponse.data?.starts_at ?? null,
    hasBothTeams: Boolean(match.home_team_id && match.away_team_id),
  })

  if (lockState.locked) {
    if (
      lockState.reason === 'status' ||
      lockState.reason === 'started' ||
      lockState.reason === 'tournament_started'
    ) {
      return { error: 'Este partido ya no acepta pronosticos.' }
    }

    return {
      error: `Los pronosticos se cierran ${formatPredictionLockWindow(
        settings.prediction_lock_minutes,
        settings.prediction_lock_mode
      )}.`,
    }
  }

  if (existing?.confirmed) {
    if (!settings.allow_prediction_edits) {
      return { error: 'Tu pronostico ya esta confirmado y no puede cambiarse.' }
    }
  }

  const admin = createAdminClient()
  const confirmedAt = new Date().toISOString()
  const predictionPayload = {
    away_score: awayScore,
    confirmed: true,
    confirmed_at: confirmedAt,
    home_score: homeScore,
    league_id: leagueId,
    match_id: matchId,
    user_id: user.id,
  }

  const writeResponse = existing?.id
    ? await admin
        .from('predictions')
        .update({
          away_score: awayScore,
          confirmed: true,
          confirmed_at: confirmedAt,
          home_score: homeScore,
        })
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .eq('league_id', leagueId)
    : await admin
        .from('predictions')
        .insert(predictionPayload)

  if (writeResponse.error) {
    return {
      error: `No se pudo guardar el pronostico. ${writeResponse.error.message}`,
    }
  }

  revalidatePath(`/leagues/${leagueId}/predictions`)
  return {
    savedPair: `${homeScore}-${awayScore}`,
    success: true,
  }
}
