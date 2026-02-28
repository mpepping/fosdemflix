import { XMLParser } from 'fast-xml-parser'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

interface Talk {
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

// fast-xml-parser output types
type XmlText = string | number | boolean
type XmlNode = XmlText | XmlObj
interface XmlObj { [key: string]: XmlNode | XmlNode[] }

function str(val: XmlNode | undefined): string {
  if (val === undefined || val === null) return ''
  return String(val)
}

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return []
  return Array.isArray(val) ? val : [val]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyLink(href: string): 'mp4' | 'webm' | 'vtt' | null {
  if (!href.includes('video.fosdem.org')) return null
  if (href.endsWith('.mp4')) return 'mp4'
  if (href.endsWith('.webm')) return 'webm'
  if (href.endsWith('.vtt')) return 'vtt'
  return null
}

function parseEvents(scheduleObj: XmlObj, year: number): Talk[] {
  const schedule = scheduleObj['schedule'] as XmlObj | undefined
  if (!schedule) return []

  const talks: Talk[] = []
  const days = toArray(schedule['day'] as XmlObj | XmlObj[])

  for (const day of days) {
    const rooms = toArray(day['room'] as XmlObj | XmlObj[])
    for (const room of rooms) {
      const events = toArray(room['event'] as XmlObj | XmlObj[])
      for (const event of events) {
        const id = str(event['@_id'])
        const title = str(event['title'])
        const slug = str(event['slug'])
        const roomName = str(event['room'])

        // Track can be string or object with text
        const trackRaw = event['track']
        let track: string
        if (typeof trackRaw === 'object' && trackRaw !== null && !Array.isArray(trackRaw)) {
          track = str((trackRaw as XmlObj)['#text'] ?? '')
        } else {
          track = str(trackRaw)
        }

        const start = str(event['start'])
        const duration = str(event['duration'])
        const abstractRaw = str(event['abstract'])
        const abstract = stripHtml(abstractRaw)
        const talkUrl = str(event['url'])

        // Extract speakers - persons > person (text content)
        const personsNode = event['persons'] as XmlObj | undefined
        const personRaw = personsNode?.['person']
        const persons = toArray(personRaw as XmlNode | XmlNode[])
        const speakers = persons.map(p => {
          if (typeof p === 'object' && p !== null && !Array.isArray(p)) {
            return str((p as XmlObj)['#text'] ?? '')
          }
          return str(p)
        }).filter(Boolean)

        // Extract video links - links > link (href attribute)
        const linksNode = event['links'] as XmlObj | undefined
        const linkRaw = linksNode?.['link']
        const links = toArray(linkRaw as XmlNode | XmlNode[])

        let videoMp4: string | undefined
        let videoWebm: string | undefined
        let subtitles: string | undefined

        for (const link of links) {
          let href: string
          if (typeof link === 'object' && link !== null && !Array.isArray(link)) {
            href = str((link as XmlObj)['@_href'] ?? '')
          } else {
            href = str(link)
          }

          const kind = classifyLink(href)
          if (kind === 'mp4' && !videoMp4) videoMp4 = href
          else if (kind === 'webm' && !videoWebm) videoWebm = href
          else if (kind === 'vtt' && !subtitles) subtitles = href
        }

        // Only include talks with at least one video URL
        if (!videoMp4 && !videoWebm) continue
        if (!title || !id) continue

        talks.push({
          id: `${year}-${id}`,
          year,
          title,
          slug,
          room: roomName,
          track: track || 'Other',
          speakers,
          abstract,
          videoMp4,
          videoWebm,
          subtitles,
          talkUrl,
          start,
          duration,
        })
      }
    }
  }

  return talks
}

async function fetchYear(year: number): Promise<Talk[]> {
  const url =
    year === 2026
      ? 'https://fosdem.org/2026/schedule/xml'
      : `https://archive.fosdem.org/${year}/schedule/xml`

  console.log(`Fetching ${year} from ${url}…`)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'fosdemflix/1.0 (https://github.com/fosdemflix)' },
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      console.warn(`  ⚠ HTTP ${res.status} for ${year}, skipping`)
      return []
    }

    const xml = await res.text()

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      allowBooleanAttributes: true,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
    })

    const parsed = parser.parse(xml) as XmlObj
    const talks = parseEvents(parsed, year)
    console.log(`  ✓ ${talks.length} talks with video for ${year}`)
    return talks
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch ${year}:`, (err as Error).message)
    return []
  }
}

async function main() {
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
  const allTalks: Talk[] = []

  for (const year of years) {
    const talks = await fetchYear(year)
    allTalks.push(...talks)
  }

  console.log(`\nTotal talks with video: ${allTalks.length}`)

  mkdirSync(join(ROOT, 'public', 'data'), { recursive: true })
  const outPath = join(ROOT, 'public', 'data', 'talks.json')
  writeFileSync(outPath, JSON.stringify(allTalks))
  console.log(`Written to ${outPath}`)

  // Year breakdown
  const byYear = allTalks.reduce<Record<number, number>>((acc, t) => {
    acc[t.year] = (acc[t.year] ?? 0) + 1
    return acc
  }, {})
  console.log('\nBreakdown by year:')
  for (const [year, count] of Object.entries(byYear).sort()) {
    console.log(`  ${year}: ${count} talks`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
