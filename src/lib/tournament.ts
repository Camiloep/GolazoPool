// A match's "section" is the unit used both for the league round tabs and for the
// `phase_start` prediction lock mode. The group stage is split into 3 rounds
// (group_round_1/2/3); knockout phases map 1:1 to their phase key.
export function getMatchSectionKey(phase: string, matchNumber: number) {
  if (phase === 'group') {
    const posInGroup = (matchNumber - 1) % 6
    const round = Math.floor(posInGroup / 2) + 1
    return `group_round_${round}`
  }

  return phase
}

type SectionMatch = {
  phase: string
  match_number: number
  starts_at: string
}

// Earliest kickoff per section. Used by `phase_start` lock mode: every match in a
// section locks relative to the start of its section's first match.
export function buildSectionStartMap(matches: SectionMatch[]): Record<string, string> {
  const bySection: Record<string, string> = {}

  for (const match of matches) {
    const key = getMatchSectionKey(match.phase, match.match_number)
    const current = bySection[key]

    if (!current || new Date(match.starts_at).getTime() < new Date(current).getTime()) {
      bySection[key] = match.starts_at
    }
  }

  return bySection
}
