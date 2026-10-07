import type { PostgrestError } from '@supabase/supabase-js'

export function isMissingAppAdminsTable(error: PostgrestError | null | undefined) {
  return error?.code === 'PGRST205'
}
