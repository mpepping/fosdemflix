import MiniSearch from 'minisearch'
import type { Talk } from './types.ts'

let miniSearch: MiniSearch<Talk> | null = null

export function buildIndex(talks: Talk[]): void {
  miniSearch = new MiniSearch<Talk>({
    fields: ['title', 'abstract', 'speakersText', 'track'],
    storeFields: [
      'id', 'year', 'title', 'slug', 'room', 'track',
      'speakers', 'abstract', 'videoMp4', 'videoWebm',
      'subtitles', 'talkUrl', 'start', 'duration',
    ],
    searchOptions: {
      boost: { title: 3, speakersText: 2, track: 1.5, abstract: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
    idField: 'id',
  })

  // Add a flat speakers string for indexing
  const docs = talks.map(t => ({
    ...t,
    speakersText: t.speakers.join(' '),
  }))

  miniSearch.addAll(docs)
}

export function search(query: string): Talk[] {
  if (!miniSearch) return []
  if (!query.trim()) return []

  const results = miniSearch.search(query)
  return results.map(r => ({
    id: r.id as string,
    year: r.year as number,
    title: r.title as string,
    slug: r.slug as string,
    room: r.room as string,
    track: r.track as string,
    speakers: r.speakers as string[],
    abstract: r.abstract as string,
    videoMp4: r.videoMp4 as string | undefined,
    videoWebm: r.videoWebm as string | undefined,
    subtitles: r.subtitles as string | undefined,
    talkUrl: r.talkUrl as string,
    start: r.start as string,
    duration: r.duration as string,
  }))
}
