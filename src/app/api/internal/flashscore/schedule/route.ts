import { scrapeWorldCupSchedule } from '@/server/flashscore/html-scraper'

export const runtime = 'nodejs'

function readSecret(request: Request) {
  const bearerToken = request.headers.get('authorization')
  if (bearerToken?.startsWith('Bearer ')) {
    return bearerToken.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-internal-cron-secret')?.trim() ?? null
}

export async function GET(request: Request) {
  const expectedSecret = process.env.INTERNAL_CRON_SECRET?.trim()

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
    const rounds = await scrapeWorldCupSchedule()
    return Response.json({ rounds })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Flashscore schedule scrape failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
