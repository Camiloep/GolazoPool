// Match kickoff times are stored as absolute ISO timestamps (UTC). They must
// always be displayed in Colombia time, regardless of where the code runs —
// browser timezones vary and SSR on Vercel defaults to UTC. Passing the
// `timeZone` option explicitly keeps the output identical on server and client.
export const COLOMBIA_TIME_ZONE = 'America/Bogota'

const DATE_LOCALE = 'es-MX'

export function formatMatchDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
) {
  return new Date(value).toLocaleDateString(DATE_LOCALE, {
    timeZone: COLOMBIA_TIME_ZONE,
    ...options,
  })
}

export function formatMatchTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
) {
  return new Date(value).toLocaleTimeString(DATE_LOCALE, {
    timeZone: COLOMBIA_TIME_ZONE,
    ...options,
  })
}

// Calendar parts (year/month/day) resolved in Colombia time. Useful for
// grouping and comparing dates without falling back to the runtime timezone,
// which would shift around midnight (Colombia is UTC-5).
export function getColombiaDateParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value)

  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
  }
}

// `YYYY-MM-DD` key in Colombia time, safe for equality comparisons.
export function getColombiaDayKey(value: string | Date) {
  const { year, month, day } = getColombiaDateParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
