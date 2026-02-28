export interface Talk {
  id: string
  year: number
  title: string
  slug: string
  room: string
  track: string
  speakers: string[]
  abstract: string
  videoMp4?: string
  videoWebm?: string
  subtitles?: string
  talkUrl: string
  start: string
  duration: string
}

export interface FilterState {
  year: number | 'all'
  track: string
  query: string
  speaker: string
}
