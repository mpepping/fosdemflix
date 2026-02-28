import './styles/main.css'
import './styles/cards.css'
import './styles/player.css'
import './styles/search.css'

import type { Talk, FilterState } from './types.ts'
import { buildIndex, search } from './search.ts'
import { applyFilters, getUniqueTracks, hasActiveFilters } from './filters.ts'
import { openPlayer, initPlayer } from './player.ts'

// Track color map
const TRACK_COLORS: Record<string, string> = {
  'Rust': '#e8632a',
  'Python': '#3572a5',
  'Security': '#c0392b',
  'JavaScript': '#f1e05a',
  'Go': '#00add8',
  'Networking': '#2980b9',
  'Database': '#336791',
  'Linux': '#f9a825',
  'Containers': '#0db7ed',
  'Embedded': '#89b4fa',
  'Web': '#e96228',
  'Cloud': '#5bbad5',
  'AI': '#ab68ff',
  'Testing': '#4ec9b0',
  'DevOps': '#6c9bd1',
  'Kernel': '#dd4814',
  'Open Source': '#3da639',
  'Hardware': '#b8860b',
  'Accessibility': '#9b59b6',
  'Community': '#27ae60',
}

function getTrackColor(track: string): string {
  for (const [key, color] of Object.entries(TRACK_COLORS)) {
    if (track.toLowerCase().includes(key.toLowerCase())) return color
  }
  let hash = 0
  for (let i = 0; i < track.length; i++) {
    hash = (hash * 31 + track.charCodeAt(i)) >>> 0
  }
  return `hsl(${hash % 360}, 60%, 45%)`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderCard(talk: Talk): string {
  const color = getTrackColor(talk.track)
  const speakers = talk.speakers.length
    ? `<p class="card-speakers">${escapeHtml(talk.speakers.slice(0, 3).join(', '))}</p>`
    : ''
  const abstract = talk.abstract
    ? `<p class="card-abstract">${escapeHtml(talk.abstract.slice(0, 140))}…</p>`
    : ''

  return `
    <article class="video-card" data-id="${escapeHtml(talk.id)}" role="button" tabindex="0" aria-label="Watch: ${escapeHtml(talk.title)}">
      <div class="card-track-band" style="background:${color}">
        <span class="card-track-name">${escapeHtml(talk.track)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(talk.title)}</h3>
        ${speakers}
        ${abstract}
      </div>
      <div class="card-footer">
        <span class="card-year">${talk.year}</span>
        <span class="card-room">${escapeHtml(talk.room)}</span>
        <span class="card-play-icon">▶</span>
      </div>
    </article>
  `
}

function renderGrid(talks: Talk[]): void {
  const grid = document.getElementById('video-grid')!
  const countEl = document.getElementById('results-count')!

  if (talks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>No talks found.</p>
        <p class="empty-hint">Try clearing your filters or search query.</p>
      </div>
    `
  } else {
    grid.innerHTML = talks.map(renderCard).join('')

    grid.querySelectorAll<HTMLElement>('.video-card').forEach(card => {
      const handler = () => {
        const talk = talkMap.get(card.dataset.id!)
        if (talk) openPlayer(talk)
      }
      card.addEventListener('click', handler)
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handler()
        }
      })
    })

    // Arrow key navigation between cards
    grid.addEventListener('keydown', e => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.video-card')
      if (!card) return

      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      if (!keys.includes(e.key)) return
      e.preventDefault()

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.video-card'))
      const idx = cards.indexOf(card)
      const cols = Math.max(1, Math.floor(grid.clientWidth / 260))

      const delta: Record<string, number> = {
        ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols,
      }
      const next = idx + delta[e.key]!
      if (next >= 0 && next < cards.length) cards[next].focus()
    }, { capture: false })
  }

  countEl.textContent = `${talks.length.toLocaleString()} talk${talks.length === 1 ? '' : 's'}`
}

// Global state
let allTalks: Talk[] = []
const talkMap = new Map<string, Talk>()
const filters: FilterState = { year: 'all', track: '', query: '' }
let searchDebounce: ReturnType<typeof setTimeout> | null = null

function getVisibleTalks(): Talk[] {
  const results = filters.query.trim() ? search(filters.query) : allTalks
  return applyFilters(results, filters)
}

// --- Share link (URL hash) ---

function syncHash(): void {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.year !== 'all') params.set('year', String(filters.year))
  if (filters.track) params.set('track', filters.track)
  const hash = params.toString()
  history.replaceState(null, '', hash ? '#' + hash : location.pathname)
}

function restoreFromHash(
  searchInput: HTMLInputElement,
  trackFilter: HTMLSelectElement,
  yearFilters: HTMLElement,
): void {
  const hash = location.hash.slice(1)
  if (!hash) return
  const params = new URLSearchParams(hash)

  const q = params.get('q')
  if (q) { filters.query = q; searchInput.value = q }

  const year = params.get('year')
  if (year) {
    const parsed = parseInt(year, 10)
    if (!isNaN(parsed)) {
      filters.year = parsed
      yearFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
      yearFilters.querySelector<HTMLElement>(`[data-year="${parsed}"]`)?.classList.add('active')
    }
  }

  const track = params.get('track')
  if (track) {
    filters.track = track
    trackFilter.value = track
  }
}

// ---

function update(): void {
  renderGrid(getVisibleTalks())
  const clearBtn = document.getElementById('clear-filters')!
  clearBtn.style.display = hasActiveFilters(filters) ? 'inline-block' : 'none'
  syncHash()
}

function populateTrackFilter(talks: Talk[]): void {
  const select = document.getElementById('track-filter') as HTMLSelectElement
  const tracks = getUniqueTracks(talks)
  const existing = Array.from(select.options).map(o => o.value)
  for (const track of tracks) {
    if (!existing.includes(track)) {
      const opt = document.createElement('option')
      opt.value = track
      opt.textContent = track
      select.appendChild(opt)
    }
  }
}

async function init(): Promise<void> {
  initPlayer()

  const res = await fetch('/data/talks.json')
  allTalks = (await res.json() as Talk[]).sort((a, b) => b.year - a.year)

  for (const talk of allTalks) talkMap.set(talk.id, talk)

  buildIndex(allTalks)
  populateTrackFilter(allTalks)

  const searchInput = document.getElementById('search-input') as HTMLInputElement
  const trackFilter = document.getElementById('track-filter') as HTMLSelectElement
  const yearFilters = document.getElementById('year-filters')!
  const clearBtn = document.getElementById('clear-filters')!

  // Restore state from URL hash before first render
  restoreFromHash(searchInput, trackFilter, yearFilters)
  update()

  // Search
  searchInput.addEventListener('input', () => {
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      filters.query = searchInput.value
      update()
    }, 150)
  })

  // Year pills
  yearFilters.addEventListener('click', e => {
    const pill = (e.target as HTMLElement).closest<HTMLElement>('[data-year]')
    if (!pill) return
    yearFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
    pill.classList.add('active')
    const val = pill.dataset.year!
    filters.year = val === 'all' ? 'all' : parseInt(val, 10)
    update()
  })

  // Track filter
  trackFilter.addEventListener('change', () => {
    filters.track = trackFilter.value
    update()
  })

  // Clear filters
  // Shuffle / random talk
  document.getElementById('shuffle-btn')!.addEventListener('click', () => {
    const visible = getVisibleTalks()
    if (visible.length === 0) return
    const talk = visible[Math.floor(Math.random() * visible.length)]!
    openPlayer(talk)
  })

  clearBtn.addEventListener('click', () => {
    filters.year = 'all'
    filters.track = ''
    filters.query = ''
    searchInput.value = ''
    trackFilter.value = ''
    yearFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
    yearFilters.querySelector<HTMLElement>('[data-year="all"]')?.classList.add('active')
    update()
  })

}

init().catch(err => {
  console.error('Failed to initialize:', err)
  document.getElementById('video-grid')!.innerHTML =
    `<div class="error-state"><p>Failed to load talks data. Please refresh.</p></div>`
})
