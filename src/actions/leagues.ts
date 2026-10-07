'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_ALLOW_PREDICTION_EDITS,
  DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
  DEFAULT_MEMBER_PREDICTION_VISIBILITY,
  DEFAULT_PREDICTION_LOCK_MINUTES,
  DEFAULT_PREDICTION_LOCK_MODE,
  DEFAULT_REQUIRE_MATCH_PREDICTION_FOR_PICK_VISIBILITY,
  DEFAULT_TIE_BREAKER_ORDER,
  isMissingLeagueSettingsTable,
} from '@/lib/league-settings'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const MISSING_SETTINGS_TABLE_MESSAGE =
  'Falta crear la tabla de configuracion. Aplica el script database/league_settings.sql en Supabase.'

function isLegacyTieBreakerConstraintError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === '23514' &&
    typeof error.message === 'string' &&
    error.message.includes('league_settings_tie_breaker_order_check')
  )
}

export async function removeMember(formData: FormData) {
  const leagueId = formData.get('league_id') as string
  const targetUserId = formData.get('target_user_id') as string

  if (!leagueId || !targetUserId) return { error: 'Datos incompletos.' }

  // Use user client for auth checks — RLS enforces read access
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (targetUserId === user.id) return { error: 'No puedes expulsarte a ti mismo.' }

  const [{ data: myMembership }, { data: targetMembership }] = await Promise.all([
    supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', user.id).single(),
    supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', targetUserId).single(),
  ])

  if (myMembership?.role !== 'admin') return { error: 'No tienes permiso para realizar esta acción.' }
  if (!targetMembership) return { error: 'El miembro no existe en esta liga.' }
  if (targetMembership.role === 'admin') return { error: 'No puedes expulsar a otro administrador.' }

  // Use admin client to bypass RLS — authorization was verified above
  const admin = createAdminClient()
  const [{ error: memberError }, { error: predictionsError }] = await Promise.all([
    admin.from('league_members').delete().eq('league_id', leagueId).eq('user_id', targetUserId),
    admin.from('predictions').delete().eq('league_id', leagueId).eq('user_id', targetUserId),
  ])

  if (memberError || predictionsError) return { error: 'No se pudo expulsar al miembro.' }

  revalidatePath(`/leagues/${leagueId}/admin`)
  return { success: true }
}

export async function createLeague(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!name || name.length < 3) return { error: 'El nombre debe tener al menos 3 caracteres.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: league, error } = await admin
    .from('leagues')
    .insert({ name, description, created_by: user.id })
    .select('id')
    .single()

  if (error || !league) return { error: 'No se pudo crear la liga.' }

  const cleanupLeague = async () => {
    await admin.from('leagues').delete().eq('id', league.id)
  }

  // Creator becomes admin automatically
  const { error: memberError } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: user.id,
    role: 'admin',
  })

  if (memberError) {
    await cleanupLeague()
    return { error: `No se pudo asignar el administrador de la liga. ${memberError.message}` }
  }

  let { error: settingsError } = await admin.from('league_settings').insert({
    league_id: league.id,
    allow_prediction_edits: DEFAULT_ALLOW_PREDICTION_EDITS,
    member_prediction_visibility: DEFAULT_MEMBER_PREDICTION_VISIBILITY,
    member_prediction_view_mode: DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
    require_match_prediction_for_pick_visibility:
      DEFAULT_REQUIRE_MATCH_PREDICTION_FOR_PICK_VISIBILITY,
    tie_breaker_order: DEFAULT_TIE_BREAKER_ORDER,
    prediction_lock_minutes: DEFAULT_PREDICTION_LOCK_MINUTES,
    prediction_lock_mode: DEFAULT_PREDICTION_LOCK_MODE,
    updated_by: user.id,
  })

  if (isLegacyTieBreakerConstraintError(settingsError)) {
    const retryResult = await admin.from('league_settings').insert({
      league_id: league.id,
      updated_by: user.id,
    })

    settingsError = retryResult.error
  }

  if (settingsError) {
    await cleanupLeague()

    if (isMissingLeagueSettingsTable(settingsError)) {
      return { error: MISSING_SETTINGS_TABLE_MESSAGE }
    }

    return { error: `No se pudo crear la configuracion inicial de la liga. ${settingsError.message}` }
  }

  revalidatePath('/dashboard')
  redirect(`/leagues/${league.id}`)
}

export async function joinLeague(formData: FormData) {
  const invite_code = (formData.get('invite_code') as string)?.trim().toUpperCase()

  if (!invite_code) return { error: 'Ingresa el código de invitación.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client to bypass RLS — leagues are only readable by their members,
  // so the invite code is the authorization to look one up and join it.
  const admin = createAdminClient()

  const { data: league, error: findError } = await admin
    .from('leagues')
    .select('id, name')
    .eq('invite_code', invite_code)
    .single()

  if (findError || !league) return { error: 'Código inválido. Revisa que esté bien escrito.' }

  const { error: insertError } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: user.id,
    role: 'member',
  })

  if (insertError) {
    // 23505 = ya es miembro: en vez de mostrar error, llevarlo a la liga.
    if (insertError.code === '23505') redirect(`/leagues/${league.id}`)
    return { error: 'No se pudo unir a la liga.' }
  }

  revalidatePath('/dashboard')
  redirect(`/leagues/${league.id}`)
}
