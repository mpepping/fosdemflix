import type { Talk } from './types.ts'
import { toggleWatchlist, isInWatchlist } from './watchlist.ts'

const overlay = document.getElementById('modal-overlay') as HTMLElement
const video = document.getElementById('modal-video') as HTMLVideoElement
const modalInfo = document.getElementById('modal-info') as HTMLElement
const closeBtn = document.getElementById('modal-close') as HTMLButtonElement

export function openPlayer(talk: Talk): void {
  video.innerHTML = ''

  if (talk.videoWebm) {
    const src = document.createElement('source')
    src.src = talk.videoWebm
    src.type = 'video/webm'
    video.appendChild(src)
  }

  if (talk.videoMp4) {
    const src = document.createElement('source')
    src.src = talk.videoMp4
    src.type = 'video/mp4'
    video.appendChild(src)
  }

  if (talk.subtitles) {
    const track = document.createElement('track')
    track.src = talk.subtitles
    track.kind = 'subtitles'
    track.label = 'English'
    track.srclang = 'en'
    video.appendChild(track)
  }

  video.load()

  const videoUrl = talk.videoMp4 ?? talk.videoWebm ?? ''
  const inList = isInWatchlist(talk.id)

  const speakersHtml = talk.speakers.length
    ? `<p class="modal-speakers">${talk.speakers.map(s =>
        `<button class="speaker-link" data-speaker="${escapeHtml(s)}">${escapeHtml(s)}</button>`
      ).join(', ')}</p>`
    : ''

  const abstractHtml = talk.abstract
    ? `<p class="modal-abstract">${escapeHtml(talk.abstract)}</p>`
    : ''

  const actions = `<div class="modal-actions">
    ${talk.talkUrl ? `<a href="${escapeHtml(talk.talkUrl)}" target="_blank" rel="noopener noreferrer" class="modal-link">View on FOSDEM →</a>` : ''}
    ${videoUrl ? `<button class="modal-link copy-url-btn" data-url="${escapeHtml(videoUrl)}">Copy video link</button>` : ''}
    <button class="modal-link watchlist-btn${inList ? ' saved' : ''}" data-id="${escapeHtml(talk.id)}">
      ${inList ? '✓ Saved' : '+ Watchlist'}
    </button>
  </div>`

  modalInfo.innerHTML = `
    <h2 class="modal-title">${escapeHtml(talk.title)}</h2>
    <div class="modal-meta">
      <span class="modal-badge year">${talk.year}</span>
      <span class="modal-badge room">${escapeHtml(talk.room)}</span>
      <span class="modal-badge track">${escapeHtml(talk.track)}</span>
      ${talk.duration ? `<span class="modal-badge duration">${escapeHtml(talk.duration)}</span>` : ''}
    </div>
    ${speakersHtml}
    ${abstractHtml}
    ${actions}
  `

  overlay.classList.add('active')
  document.body.style.overflow = 'hidden'
}

export function closePlayer(): void {
  overlay.classList.remove('active')
  video.pause()
  video.removeAttribute('src')
  video.innerHTML = ''
  video.load()
  document.body.style.overflow = ''
}

export function initPlayer(): void {
  closeBtn.addEventListener('click', closePlayer)

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closePlayer()
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closePlayer()
  })

  // Copy video URL
  modalInfo.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.copy-url-btn')
    if (!btn) return
    const url = btn.dataset.url!
    navigator.clipboard.writeText(url).then(() => {
      const original = btn.textContent!
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = original
        btn.classList.remove('copied')
      }, 2000)
    })
  })

  // Watchlist toggle
  modalInfo.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.watchlist-btn')
    if (!btn) return
    const id = btn.dataset.id!
    const inList = toggleWatchlist(id)
    btn.textContent = inList ? '✓ Saved' : '+ Watchlist'
    btn.classList.toggle('saved', inList)
    document.dispatchEvent(new CustomEvent('fosdemflix:watchlist-change', { detail: { id, inList } }))
  })

  // Speaker link — close player and filter by speaker
  modalInfo.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.speaker-link')
    if (!btn) return
    closePlayer()
    document.dispatchEvent(new CustomEvent('fosdemflix:speaker', { detail: btn.dataset.speaker }))
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
