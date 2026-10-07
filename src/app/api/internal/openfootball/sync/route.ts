import { syncWorldCupFromOpenFootball } from '@/server/openfootball/sync'

export const runtime = 'nodejs'

function readSecret(request: Request) {
  const bearerToken = request.headers.get('authorization')
  if (bearerToken?.startsWith('Bearer ')) {
    return bearerToken.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-internal-cron-secret')?.trim() ?? null
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_CRON_SECRET?.trim()
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  if (!expectedSecret) {
    return Response.json(
      { error: 'Missing INTERNAL_CRON_SECRET on the server.' },
      { status: 500 }
    )
  }

  if (readSecret(request) !== expectedSecret) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const summary = await syncWorldCupFromOpenFootball({ dryRun })
    return Response.json({ ...summary, dryRun })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'OpenFootball sync failed unexpectedly.'

    return Response.json({ error: message }, { status: 500 })
  }
}
