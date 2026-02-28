import type { FilterState, Talk } from './types.ts'

export function applyFilters(talks: Talk[], filters: FilterState): Talk[] {
  return talks.filter(talk => {
    if (filters.year !== 'all' && talk.year !== filters.year) return false
    if (filters.track && talk.track !== filters.track) return false
    return true
  })
}

export function getUniqueTracks(talks: Talk[]): string[] {
  const tracks = new Set(talks.map(t => t.track))
  return Array.from(tracks).sort()
}

export function hasActiveFilters(filters: FilterState): boolean {
  return filters.year !== 'all' || filters.track !== '' || filters.query !== ''
}
