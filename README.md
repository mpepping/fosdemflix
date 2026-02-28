# fosdemflix

A Netflix-like browser for [FOSDEM](https://fosdem.org) conference videos, covering 2020–2026.

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run fetch-data` | Fetch FOSDEM schedule XMLs and regenerate `public/data/talks.json` |
| `npm run dev` | Start local dev server |
| `npm run build` | Build static site to `dist/` |
| `npm run preview` | Preview the production build locally |

## Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Updating talk data

Talk data is pre-generated and committed at `public/data/talks.json`. To refresh it (e.g. after a new FOSDEM edition):

```bash
npm run fetch-data
```

This fetches schedule XMLs from `archive.fosdem.org` (2020–2025) and `fosdem.org` (2026), filters to talks with video recordings, and writes the result to `public/data/talks.json`.

## Production build

```bash
npm run build
npm run preview
```

The output in `dist/` is a fully static site with no server required.
