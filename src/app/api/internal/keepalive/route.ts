import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Daily Vercel Cron (vercel.json). A real read through the Supabase API counts as
// activity, so the Free plan project is not paused while nobody uses the app.
// Vercel sends CRON_SECRET as "Authorization: Bearer <value>".
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim()

  if (!expectedSecret) {
    return Response.json({ error: 'Missing CRON_SECRET on the server.' }, { status: 500 })
  }

  if (request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { count, error } = await createAdminClient()
    .from('matches')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, matches: count })
}
