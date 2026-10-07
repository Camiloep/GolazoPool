'use server'

import { refresh, revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  CORE_TIE_BREAKER_ORDER,
  DEFAULT_MEMBER_PREDICTION_VISIBILITY,
  DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
  DEFAULT_PREDICTION_LOCK_MODE,
  isMissingLeagueSettingsTable,
  MAX_PREDICTION_LOCK_MINUTES,
  normalizeTieBreakerOrder,
  TIE_BREAKER_OPTIONS,
} from '@/lib/league-settings'
import type {
  LeaderboardTieBreakerCriterion,
  MemberPredictionViewMode,
  MemberPredictionVisibility,
  PredictionLockMode,
} from '@/lib/types'

const MISSING_SETTINGS_TABLE_MESSAGE =
  'Falta crear la tabla de configuracion. Aplica el script database/league_settings.sql en Supabase.'
const LEGACY_TIE_BREAKER_CONSTRAINT_MESSAGE =
  'No se pudo guardar el orden de desempates porque la base tiene una constraint antigua. Aplica el script database/league_settings.sql en Supabase y vuelve a intentar.'

function areStringArraysEqual(left: string[] | null, right: string[] | null) {
  if (left === right) return true
  if (!left || !right) return false
  if (left.length !== right.length) return false

  return left.every((value, index) => value === right[index])
}

function isLegacyTieBreakerConstraintError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === '23514' &&
    typeof error.message === 'string' &&
    error.message.includes('league_settings_tie_breaker_order_check')
  )
}

export async function saveLeagueSettings(formData: FormData) {
  const leagueId = (formData.get('league_id') as string | null)?.trim()
  const rules = (formData.get('rules') as string | null)?.trim() || null
  const prizes = (formData.get('prizes') as string | null)?.trim() || null
  const allowPredictionEdits = formData.get('allow_prediction_edits') === 'on'
  const allowMemberPickVisibility = formData.get('allow_member_pick_visibility') === 'on'
  const requireMatchPredictionForPickVisibility =
    formData.get('require_match_prediction_for_pick_visibility') === 'on'
  const memberPredictionVisibilityValue =
    (formData.get('member_prediction_visibility') as string | null)?.trim() ?? DEFAULT_MEMBER_PREDICTION_VISIBILITY
  const memberPredictionViewModeValue =
    (formData.get('member_prediction_view_mode') as string | null)?.trim() ?? DEFAULT_MEMBER_PREDICTION_VIEW_MODE
  const predictionLockModeValue =
    (formData.get('prediction_lock_mode') as string | null)?.trim() ?? DEFAULT_PREDICTION_LOCK_MODE
  const lockMinutesValue = (formData.get('prediction_lock_minutes') as string | null)?.trim() ?? '0'
  const predictionLockMinutes = Number.parseInt(lockMinutesValue, 10)
  const tieBreakerCountValue = (formData.get('tie_breaker_count') as string | null)?.trim() ?? '0'
  const tieBreakerCount = Number.parseInt(tieBreakerCountValue, 10)
  const tieBreakerOrderValues: LeaderboardTieBreakerCriterion[] = Array.from(
    { length: Number.isNaN(tieBreakerCount) ? 0 : tieBreakerCount },
    (_value, index) => {
      const criterion = formData.get(`tie_breaker_${index + 1}`)
      return typeof criterion === 'string' ? criterion.trim() : ''
    }
  ) as LeaderboardTieBreakerCriterion[]
  const memberPredictionVisibility: MemberPredictionVisibility =
    !allowMemberPickVisibility
      ? 'never'
      : memberPredictionVisibilityValue === 'always'
        ? 'always'
        : 'after_lock'
  const memberPredictionViewMode: MemberPredictionViewMode =
    memberPredictionViewModeValue === 'aggregate'
      ? 'aggregate'
      : memberPredictionViewModeValue === 'participants'
        ? 'participants'
        : 'detail'
  const predictionLockMode: PredictionLockMode =
    predictionLockModeValue === 'tournament_start'
      ? 'tournament_start'
      : predictionLockModeValue === 'phase_start'
        ? 'phase_start'
        : 'per_match'
  const tieBreakerOrder = normalizeTieBreakerOrder(tieBreakerOrderValues)

  if (!leagueId) return { error: 'Liga invalida.' }
  if (
    Number.isNaN(predictionLockMinutes) ||
    predictionLockMinutes < 0 ||
    predictionLockMinutes > MAX_PREDICTION_LOCK_MINUTES
  ) {
    return { error: `La ventana de bloqueo debe estar entre 0 y ${MAX_PREDICTION_LOCK_MINUTES} minutos.` }
  }
  if (
    Number.isNaN(tieBreakerCount) ||
    tieBreakerCount < CORE_TIE_BREAKER_ORDER.length ||
    tieBreakerCount > TIE_BREAKER_OPTIONS.length ||
    tieBreakerOrderValues.length !== tieBreakerCount ||
    tieBreakerOrderValues.some(value => !value) ||
    tieBreakerOrder.length < CORE_TIE_BREAKER_ORDER.length ||
    tieBreakerOrder.some((criterion, index) => criterion !== tieBreakerOrderValues[index])
  ) {
    return { error: 'Configura un orden de desempate valido sin repetir criterios.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership, error: membershipError } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  if (membershipError || membership?.role !== 'admin') {
    return { error: 'Solo los administradores pueden editar esta configuracion.' }
  }

  const { data: existingSettings, error: existingSettingsError } = await supabase
    .from('league_settings')
    .select('tie_breaker_order')
    .eq('league_id', leagueId)
    .maybeSingle()

  if (existingSettingsError && !isMissingLeagueSettingsTable(existingSettingsError)) {
    return { error: 'No se pudo validar la configuracion actual de desempates.' }
  }

  const storedTieBreakerOrder = Array.isArray(existingSettings?.tie_breaker_order)
    ? existingSettings.tie_breaker_order.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
    : null
  const normalizedStoredTieBreakerOrder = storedTieBreakerOrder
    ? normalizeTieBreakerOrder(storedTieBreakerOrder)
    : null
  const canRetryWithStoredTieBreakerOrder =
    storedTieBreakerOrder !== null &&
    !areStringArraysEqual(storedTieBreakerOrder, normalizedStoredTieBreakerOrder) &&
    areStringArraysEqual(tieBreakerOrder, normalizedStoredTieBreakerOrder)
  const settingsPayload = {
    league_id: leagueId,
    rules,
    prizes,
    allow_prediction_edits: allowPredictionEdits,
    member_prediction_visibility: memberPredictionVisibility,
    member_prediction_view_mode: memberPredictionViewMode,
    require_match_prediction_for_pick_visibility:
      allowMemberPickVisibility && requireMatchPredictionForPickVisibility,
    tie_breaker_order: tieBreakerOrder,
    prediction_lock_minutes: predictionLockMinutes,
    prediction_lock_mode: predictionLockMode,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }

  let { error } = await supabase
    .from('league_settings')
    .upsert(settingsPayload, { onConflict: 'league_id' })

  if (isMissingLeagueSettingsTable(error)) {
    return { error: MISSING_SETTINGS_TABLE_MESSAGE }
  }

  if (isLegacyTieBreakerConstraintError(error) && canRetryWithStoredTieBreakerOrder) {
    const retryResult = await supabase.from('league_settings').upsert(
      {
        ...settingsPayload,
        tie_breaker_order: storedTieBreakerOrder,
      },
      { onConflict: 'league_id' }
    )

    error = retryResult.error
  }

  if (error) {
    if (isLegacyTieBreakerConstraintError(error)) {
      return {
        error: LEGACY_TIE_BREAKER_CONSTRAINT_MESSAGE,
      }
    }

    return { error: `No se pudo guardar la configuracion. ${error.message}` }
  }

  revalidatePath('/leagues/[id]', 'page')
  revalidatePath('/leagues/[id]', 'layout')
  revalidatePath('/leagues/[id]/admin', 'page')
  revalidatePath('/leagues/[id]/predictions', 'page')
  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/admin`)
  revalidatePath(`/leagues/${leagueId}/predictions`)
  refresh()

  return { success: true }
}
