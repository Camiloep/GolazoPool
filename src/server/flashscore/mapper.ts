import 'server-only'

import { buildTeamIndex, resolveTeam } from '@/server/openfootball/mapper'
import type { FlashscoreMatch } from './client'

type TeamIndex = ReturnType<typeof buildTeamIndex>

// Maps Flashscore team names (English from SportDB API, or Spanish from HTML scraper)
// to the canonical name the OpenFootball resolver understands.
// Add entries when a name does NOT resolve automatically.
const FLASHSCORE_TEAM_OVERRIDES: Record<string, string> = {
  // Spanish names from the HTML scraper
  'México': 'Mexico',
  'Sudáfrica': 'South Africa',
  'Corea del Sur': 'South Korea',
  'República Checa': 'Czech Republic',
  'Arabia Saudita': 'Saudi Arabia',
  'Arabia Saudí': 'Saudi Arabia',
  'Irak': 'Iraq',
  'Países Bajos': 'Netherlands',
  'Costa de Marfil': 'Ivory Coast',
  'EE.UU.': 'United States of America',
  'EE. UU.': 'United States of America',
  'Estados Unidos': 'United States of America',
  'España': 'Spain',
  'Francia': 'France',
  'Alemania': 'Germany',
  'Italia': 'Italy',
  'Japón': 'Japan',
  'Marruecos': 'Morocco',
  'Croacia': 'Croatia',
  'Suiza': 'Switzerland',
  'Turquía': 'Turkey',
  'Irán': 'Iran',
  'Dinamarca': 'Denmark',
  'Bélgica': 'Belgium',
  'Rumanía': 'Romania',
  'Escocia': 'Scotland',
  'Irlanda': 'Republic of Ireland',
  'Gales': 'Wales',
  'Eslovenia': 'Slovenia',
  'Eslovaquia': 'Slovakia',
  'Hungría': 'Hungary',
  'Suecia': 'Sweden',
  'Noruega': 'Norway',
  'Grecia': 'Greece',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Nueva Zelanda': 'New Zealand',
  'Guinea Ecuatorial': 'Equatorial Guinea',
  'Sierra Leona': 'Sierra Leone',
  'Camerún': 'Cameroon',
  'Túnez': 'Tunisia',
  'Haití': 'Haiti',
  'Panamá': 'Panama',
  'Bolivia': 'Bolivia',
  'Perú': 'Peru',
  'Brasil': 'Brazil',
  // Common alternative spellings from SportDB API
  'USA': 'United States of America',
  'United States': 'United States of America',
  'D.R. Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
}

// Keep only finished matches of the actual World Cup final tournament. The 2026
// season also returns qualification/promotion playoffs, which we must ignore.
export function isFinalTournamentResult(match: FlashscoreMatch): boolean {
  return (
    match.tournamentStage?.groupName === 'Final tournament' &&
    match.eventStage === 'FINISHED'
  )
}

export function resolveFlashscoreTeam(name: string | undefined, teamIndex: TeamIndex) {
  if (!name) return null
  const override = FLASHSCORE_TEAM_OVERRIDES[name.trim()]
  return resolveTeam(override ?? name, teamIndex)
}

export function parseScore(value: string | undefined | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export { buildTeamIndex }
