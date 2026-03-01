const KEY = 'fosdemflix:watchlist'

export function getWatchlist(): Set<string> {
  try {
    const stored = localStorage.getItem(KEY)
    return new Set(stored ? JSON.parse(stored) as string[] : [])
  } catch {
    return new Set()
  }
}

function save(list: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...list]))
}

export function toggleWatchlist(id: string): boolean {
  const list = getWatchlist()
  const added = !list.has(id)
  added ? list.add(id) : list.delete(id)
  save(list)
  return added
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().has(id)
}
