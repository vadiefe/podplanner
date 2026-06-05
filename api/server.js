import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import {
  initDB, getAllShows, upsertShow, upsertShows,
  deleteShow, deleteAllShows, savePlan, getPlans, deletePlan,
  getAllBriefs, upsertBrief, deleteBrief
} from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Retry wrapper — handles 529 overload and 529-like transient errors
async function anthropicWithRetry(params, maxRetries = 4) {
  let lastErr
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params)
    } catch (err) {
      lastErr = err
      const status = err.status || err.statusCode || 0
      const isRetryable = status === 529 || status === 529 || status === 503 ||
        (err.message && (err.message.includes('overloaded') || err.message.includes('overload')))
      if (!isRetryable) throw err
      const delay = (attempt + 1) * 8000 // 8s, 16s, 24s, 32s
      console.log(`Anthropic overloaded (attempt ${attempt + 1}), retrying in ${delay/1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ── DB: Shows ─────────────────────────────────────────────────────────────────

// GET all shows
app.get('/api/shows', async (req, res) => {
  try {
    const shows = await getAllShows()
    res.json(shows)
  } catch (err) {
    console.error('GET /api/shows error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST upsert a single show
app.post('/api/shows', async (req, res) => {
  try {
    const show = req.body
    if (!show.id) return res.status(400).json({ error: 'Show must have an id' })
    await upsertShow(show)
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /api/shows error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST bulk upsert (after file import)
app.post('/api/shows/bulk', async (req, res) => {
  try {
    const { shows } = req.body
    if (!Array.isArray(shows)) return res.status(400).json({ error: 'Expected { shows: [] }' })
    const count = await upsertShows(shows)
    res.json({ ok: true, count })
  } catch (err) {
    console.error('POST /api/shows/bulk error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE a single show
app.delete('/api/shows/:id', async (req, res) => {
  try {
    await deleteShow(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE all shows
app.delete('/api/shows', async (req, res) => {
  try {
    await deleteAllShows()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DB: Plans ─────────────────────────────────────────────────────────────────

app.get('/api/plans', async (req, res) => {
  try {
    const plans = await getPlans()
    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/plans', async (req, res) => {
  try {
    const { brief, plan } = req.body
    const saved = await savePlan(brief, plan)
    res.json(saved)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/plans/:id', async (req, res) => {
  try {
    await deletePlan(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── AI: Enrich shows with additional_notes ───────────────────────────────────
// Takes an array of {show (mapped fields), rawRow (full original row)} pairs
// Returns shows with showBio and additionalNotes filled in by AI

app.post('/api/enrich-shows', async (req, res) => {
  const { shows } = req.body
  if (!Array.isArray(shows) || !shows.length) return res.status(400).json({ error: 'No shows provided' })

  try {
    const BATCH_SIZE = 5
    const allEnriched = []

    for (let b = 0; b < shows.length; b += BATCH_SIZE) {
      const batch = shows.slice(b, b + BATCH_SIZE)

      const batchData = batch.map((s, i) => ({
        index: i,
        currentFields: {
          name: s.show.name,
          adNetwork: s.show.adNetwork,
          category: s.show.category,
          listenersPerEp: s.show.listenersPerEp,
          listenersMonthly: s.show.listenersMonthly,
          releaseFrequency: s.show.releaseFrequency,
          cpm: s.show.cpm,
          sponsorshipTypes: s.show.sponsorshipTypes,
          hostLocation: s.show.hostLocation,
          demographics: s.show.demographics,
          url: s.show.url,
          showBio: s.show.showBio,
        },
        fullRawRow: s.rawRow
      }))

      const prompt = `You are a media planning data analyst analyzing podcast show data from a rate card file.
For each show you have currentFields (already extracted) and fullRawRow (complete original file row).

Your job:
1. Read the ENTIRE fullRawRow carefully
2. Fill in any currentFields that are empty/zero/missing if the data exists anywhere in fullRawRow
3. Consolidate related info spread across columns (e.g. separate gender% columns + age columns → one demographics string)
4. Write showBio: 1-3 clear sentences about what the show is, who hosts it, what topics it covers
5. Write additionalNotes: any remaining useful info not in structured fields — booking contacts, editorial guidelines, social stats, psychographics, seasonal availability, packages, past advertiser categories, awards, USPs. Be thorough. Empty string if nothing extra.

Shows:
${JSON.stringify(batchData, null, 2)}

Return ONLY a JSON array, one object per show:
[{index:0,name:...,adNetwork:...,category:...,listenersPerEp:0,listenersMonthly:0,releaseFrequency:...,cpm:0,sponsorshipTypes:...,hostLocation:...,demographics:...,url:...,showBio:...,additionalNotes:...}]

Rules: listenersPerEp/listenersMonthly = integers, cpm = number, all others = strings, never invent data, no markdown.`

      const response = await anthropicWithRetry({
        model: 'claude-opus-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })

      let batchResult = []
      const raw = response.content[0].text.replace(/```json|```/g, '').trim()
      try {
        batchResult = JSON.parse(raw)
      } catch {
        // Try to recover partial JSON
        const m = raw.match(/\[.*\]/s)
        if (m) { try { batchResult = JSON.parse(m[0]) } catch { batchResult = [] } }
        console.error('Batch JSON parse failed, recovered:', batchResult.length, 'of', batch.length)
      }

      batch.forEach((s, i) => {
        const match = batchResult.find(e => e.index === i) || {}
        allEnriched.push({
          ...s.show,
          ...match,
          index: undefined,
          id: s.show.id,
          listenersPerEp: parseInt(match.listenersPerEp) || s.show.listenersPerEp || 0,
          listenersMonthly: parseInt(match.listenersMonthly) || s.show.listenersMonthly || 0,
          cpm: parseFloat(match.cpm) || s.show.cpm || 0,
        })
      })

      console.log('Enriched batch', Math.floor(b/BATCH_SIZE)+1, ':', allEnriched.length, 'total so far')
    }

    res.json({ shows: allEnriched })
  } catch (err) {
    console.error('Enrich error:', err)
    res.status(500).json({ error: err.message })
  }
})
// ── Briefs ───────────────────────────────────────────────────────────────────

app.get('/api/briefs', async (req, res) => {
  try { res.json(await getAllBriefs()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/briefs', async (req, res) => {
  try {
    const brief = req.body
    if (!brief.id) return res.status(400).json({ error: 'Brief must have an id' })
    await upsertBrief(brief)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/briefs/:id', async (req, res) => {
  try { await deleteBrief(req.params.id); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ── File parsing ──────────────────────────────────────────────────────────────

app.post('/api/parse-file', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  const ext = path.extname(file.originalname).toLowerCase()

  try {
    let rows = []

    if (ext === '.csv') {
      const text = fs.readFileSync(file.path, 'utf8')
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) throw new Error('CSV appears empty')
      const headers = parseCSVLine(lines[0])
      rows = lines.slice(1).map(line => {
        const vals = parseCSVLine(line)
        const obj = {}
        headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
        return obj
      }).filter(r => Object.values(r).some(v => v))
      fs.unlinkSync(file.path)
      const headers2 = rows.length ? Object.keys(rows[0]) : []
      return res.json({ type: 'csv', rows, headers: headers2, filename: file.originalname })

    } else if (ext === '.xlsx' || ext === '.xls') {
      const buffer = fs.readFileSync(file.path)
      const base64 = buffer.toString('base64')
      fs.unlinkSync(file.path)
      return res.json({ type: 'xlsx', base64, filename: file.originalname })

    } else if (ext === '.pdf') {
      const buffer = fs.readFileSync(file.path)
      const base64 = buffer.toString('base64')

      const response = await anthropicWithRetry({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            {
              type: 'text',
              text: `Extract ALL podcast/show data from this rate card document.
Return ONLY a JSON array of objects. Each object must have these fields (use null if not found):
- name: show/podcast name
- listeners: monthly listeners or downloads (number only)
- listeners_per_ep: listeners per episode (number only)
- cpm: CPM rate in USD (number only)
- category: genre/topic/vertical
- release_frequency: how often episodes release (e.g. Weekly, Daily)
- sponsorship_types: ad formats available (e.g. 30s pre-roll, 60s host read)
- host_location: city/country of host
- demographics: audience demographics (gender, age, interests)
- url: show website or link
- show_bio: 1-3 sentence description of what the show is about
- additional_notes: any other useful info not captured above (editorial guidelines, social stats, booking info, special packages, etc.)

Return ONLY the JSON array, no markdown, no explanation.`
            }
          ]
        }]
      })

      const txt = response.content[0].text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(txt)
      const enriched = parsed.map(r => ({
        name: r.name || '',
        listeners: r.listeners || '',
        listeners_per_ep: r.listeners_per_ep || '',
        cpm: r.cpm || '',
        category: r.category || '',
        release_frequency: r.release_frequency || '',
        sponsorship_types: r.sponsorship_types || '',
        host_location: r.host_location || '',
        demographics: r.demographics || '',
        url: r.url || '',
        show_bio: r.show_bio || '',
        additional_notes: r.additional_notes || ''
      }))

      fs.unlinkSync(file.path)
      return res.json({ type: 'pdf_extracted', rows: enriched, filename: file.originalname })
    }

  } catch (err) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    console.error('Parse error:', err)
    res.status(500).json({ error: err.message })
  }
})

function parseCSVLine(line) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += line[i] }
  }
  result.push(current)
  return result
}

// ── Generate media plan ───────────────────────────────────────────────────────

app.post('/api/generate-plan', async (req, res) => {
  const { podcasts, brief } = req.body
  if (!podcasts?.length) return res.status(400).json({ error: 'No podcasts provided' })
  if (!brief?.brandName) return res.status(400).json({ error: 'No brief provided' })

  // Smart pre-filter: score shows for relevance, take top 80
  const briefText = [brief.brandName, brief.brandDesc, brief.category, brief.targetAudience, brief.campaignGoal, brief.notes].join(' ').toLowerCase()
  const briefWords = briefText.split(/\W+/).filter(w => w.length > 3)

  function scoreShow(p) {
    let score = 0
    const showText = [p.name, p.category, p.demographics, p.showBio, p.additionalNotes].join(' ').toLowerCase()
    briefWords.forEach(w => { if (showText.includes(w)) score += 2 })
    if (p.cpm > 0) score += 3
    if (p.listenersPerEp > 0 || p.listenersMonthly > 0) score += 2
    if (p.demographics) score += 2
    if (p.showBio) score += 1
    if (p.additionalNotes) score += 1
    return score
  }

  const candidates = podcasts
    .map(p => ({ p, score: scoreShow(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map(x => x.p)

  console.log('Plan generation:', podcasts.length, 'shows filtered to', candidates.length, 'candidates')

  const podcastList = candidates.map((p, i) =>
    `${i + 1}. "${p.name}" | network: ${p.adNetwork || 'independent'} | category: ${p.category || 'unknown'} | ep_listeners: ${p.listenersPerEp || 'unknown'} | monthly_listeners: ${p.listenersMonthly || 'unknown'} | frequency: ${p.releaseFrequency || 'unknown'} | CPM: $${p.cpm || 'unknown'} | formats: ${p.sponsorshipTypes || 'unknown'} | location: ${p.hostLocation || 'unknown'} | demographics: ${p.demographics || 'unknown'} | bio: ${p.showBio || 'n/a'} | notes: ${p.additionalNotes || ''}`
  ).join('\n')

  const prompt = `You are a senior podcast media planner at a top agency. Create the optimal podcast media plan for this brand.

BRAND BRIEF:
- Brand: ${brief.brandName}
- Industry: ${brief.category || 'unspecified'}
- Description: ${brief.brandDesc}
- Target audience: ${brief.targetAudience}
- Age range: ${brief.ageRange || 'any'}
- Gender: ${brief.gender || 'all'}
- Campaign goal: ${brief.campaignGoal}
- Total budget: $${brief.budget}
- Flight: ${brief.flightWeeks} weeks
- Notes/constraints: ${brief.notes || 'none'}

AVAILABLE SHOWS (${candidates.length} pre-filtered from ${podcasts.length} total):
${podcastList}

INSTRUCTIONS:
1. Select 5–12 shows that best match the brand's audience, demographics, and category
2. Allocate budget across shows (total must be close to $${brief.budget})
3. Recommend the best ad format from each show's available sponsorship types
4. Consider audience demographics and release frequency in your selection

Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "rationale": "2–3 sentence strategy explanation",
  "selections": [
    {
      "podcastName": "exact name from list",
      "reason": "one sentence on audience/demographic fit",
      "allocatedBudget": 8000,
      "spotsPerWeek": 2,
      "adFormat": "host-read 60s mid-roll"
    }
  ]
}`

  try {
    const response = await anthropicWithRetry({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
  } catch (err) {
    console.error('Plan generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Serve frontend ────────────────────────────────────────────────────────────

const distDir = path.resolve(__dirname, '..', 'dist')
console.log('Static dir:', distDir, '| exists:', fs.existsSync(distDir))
app.use(express.static(distDir))
app.get('*', (req, res) => {
  const idx = path.join(distDir, 'index.html')
  if (fs.existsSync(idx)) {
    res.sendFile(idx)
  } else {
    res.status(404).send('Frontend not built. Run: npm run build')
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  if (process.env.DATABASE_URL) {
    await initDB()
  } else {
    console.warn('⚠️  No DATABASE_URL — running without database persistence')
  }
  app.listen(PORT, () => console.log(`\n🎙  Podcast Planner running on http://localhost:${PORT}\n`))
}

start().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
