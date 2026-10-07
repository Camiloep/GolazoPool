import type { PostgrestError } from '@supabase/supabase-js'
import type { AppSettings } from '@/lib/types'

export const DEFAULT_ALLOW_RESULT_EDITS = true

export function getDefaultAppSettings(): AppSettings {
  return {
    singleton: true,
    allow_result_edits: DEFAULT_ALLOW_RESULT_EDITS,
    updated_at: null,
    updated_by: null,
  }
}

export function normalizeAppSettings(
  settings: Partial<AppSettings> | null | undefined
): AppSettings {
  return {
    ...getDefaultAppSettings(),
    ...settings,
    singleton: true,
    allow_result_edits:
      typeof settings?.allow_result_edits === 'boolean'
        ? settings.allow_result_edits
        : DEFAULT_ALLOW_RESULT_EDITS,
  }
}

export function isMissingAppSettingsTable(error: PostgrestError | null | undefined) {
  return error?.code === 'PGRST205'
}

export function getResultEditRuleText(allowResultEdits: boolean) {
  return allowResultEdits
    ? 'Los super admins pueden corregir resultados ya finalizados.'
    : 'Los resultados finalizados quedan bloqueados y ya no se pueden corregir.'
}
