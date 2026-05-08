import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'

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

// ── Parse uploaded file ──────────────────────────────────────────────────────
app.post('/api/parse-file', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  const ext = path.extname(file.originalname).toLowerCase()

  try {
    let rows = []

    if (ext === '.csv') {
      const text = fs.readFileSync(file.path, 'utf8')
      // Simple CSV parse (PapaParse on client is better but we handle server-side too)
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) throw new Error('CSV appears empty')
      const headers = parseCSVLine(lines[0])
      rows = lines.slice(1).map(line => {
        const vals = parseCSVLine(line)
        const obj = {}
        headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
        return obj
      }).filter(r => Object.values(r).some(v => v))

    } else if (ext === '.xlsx' || ext === '.xls') {
      // We'll return raw binary for client-side XLSX parsing
      const buffer = fs.readFileSync(file.path)
      const base64 = buffer.toString('base64')
      fs.unlinkSync(file.path)
      return res.json({ type: 'xlsx', base64, filename: file.originalname })

    } else if (ext === '.pdf') {
      // Use Anthropic vision to extract table data from PDF
      const buffer = fs.readFileSync(file.path)
      const base64 = buffer.toString('base64')

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 }
            },
            {
              type: 'text',
              text: `Extract ALL podcast/show data from this rate card document. 
Return ONLY a JSON array of objects. Each object must have these fields (use null if not found):
- name: show/podcast name
- listeners: monthly listeners or downloads (number only, no commas)
- cpm: CPM rate in USD (number only)
- category: genre/topic/vertical
- description: brief description

Example: [{"name":"The Daily","listeners":3000000,"cpm":35,"category":"News","description":"NYT daily news podcast"}]

Return ONLY the JSON array, no markdown, no explanation.`
            }
          ]
        }]
      })

      const txt = response.content[0].text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(txt)
      rows = parsed.map(r => ({
        name: r.name || '',
        listeners: r.listeners || '',
        cpm: r.cpm || '',
        category: r.category || '',
        description: r.description || ''
      }))

      fs.unlinkSync(file.path)
      return res.json({ type: 'pdf_extracted', rows, headers: ['name','listeners','cpm','category','description'] })
    }

    fs.unlinkSync(file.path)
    const headers = rows.length ? Object.keys(rows[0]) : []
    res.json({ type: 'csv', rows, headers, filename: file.originalname })

  } catch (err) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    console.error('Parse error:', err)
    res.status(500).json({ error: err.message })
  }
})

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += line[i] }
  }
  result.push(current)
  return result
}

// ── Generate media plan ──────────────────────────────────────────────────────
app.post('/api/generate-plan', async (req, res) => {
  const { podcasts, brief } = req.body
  if (!podcasts?.length) return res.status(400).json({ error: 'No podcasts provided' })
  if (!brief?.brandName) return res.status(400).json({ error: 'No brief provided' })

  const podcastList = podcasts.slice(0, 100).map((p, i) =>
    `${i + 1}. "${p.name}" | category: ${p.category || 'unknown'} | monthly_listeners: ${p.listeners || 'unknown'} | CPM: $${p.cpm || 'unknown'} | desc: ${p.description || 'n/a'}`
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

AVAILABLE SHOWS (${podcasts.length} total):
${podcastList}

INSTRUCTIONS:
1. Select 5–12 shows that best match the brand's audience and category alignment
2. Allocate budget across shows (total must be close to $${brief.budget})
3. Recommend ad format based on show type and campaign goal
4. For each show: calculate based on allocated budget and CPM

Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "rationale": "2–3 sentence strategy explanation covering targeting approach and mix rationale",
  "selections": [
    {
      "podcastName": "exact name from list",
      "reason": "one sentence on audience/category fit",
      "allocatedBudget": 8000,
      "spotsPerWeek": 2,
      "adFormat": "host-read 60s mid-roll"
    }
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })

    const txt = response.content[0].text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(txt)

    // Enrich with CPM / impression data from our library
    const enriched = parsed.selections.map(s => {
      const pod = podcasts.find(p =>
        p.name === s.podcastName ||
        p.name?.toLowerCase().includes(s.podcastName?.toLowerCase()) ||
        s.podcastName?.toLowerCase().includes(p.name?.toLowerCase())
      )
      const cpm = pod?.cpm || 25
      const impressions = Math.round((s.allocatedBudget / cpm) * 1000)
      return {
        ...s,
        cpm,
        listeners: pod?.listeners || 0,
        impressions,
        podcastCategory: pod?.category || '',
        id: pod?.id || Math.random().toString(36).slice(2)
      }
    })

    res.json({ rationale: parsed.rationale, selections: enriched })
  } catch (err) {
    console.error('Plan generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Serve built frontend in production
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

app.listen(PORT, () => console.log(`\n🎙  Podcast Planner API running on http://localhost:${PORT}\n`))
