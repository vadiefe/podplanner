// Podcast Interview Booker — separate tables (ib_*), separate routes (/api/booker/*)
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import pool from './db.js'

export const bookerRouter = express.Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function claudeWithRetry(params, maxRetries = 4) {
  let lastErr
  for (let i = 0; i < maxRetries; i++) {
    try { return await anthropic.messages.create(params) } catch (err) {
      lastErr = err
      const status = err.status || 0
      const retry = status === 529 || status === 503 || /overload/i.test(err.message || '')
      if (!retry) throw err
      await new Promise(r => setTimeout(r, (i + 1) * 8000))
    }
  }
  throw lastErr
}

export async function initBookerDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ib_shows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      listeners_per_ep INTEGER DEFAULT 0,
      listeners_monthly INTEGER DEFAULT 0,
      location TEXT DEFAULT '',
      show_bio TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      url TEXT DEFAULT '',
      interview_cost NUMERIC(10,2) DEFAULT 0,
      host_email TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ib_briefs (
      id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ib_offers (
      id SERIAL PRIMARY KEY,
      brand_name TEXT NOT NULL,
      brief JSONB NOT NULL,
      offer JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  console.log('✅ Interview Booker tables ready (ib_shows, ib_briefs, ib_offers)')
}

const SHOW_SELECT = `SELECT id, name, category,
  listeners_per_ep AS "listenersPerEp", listeners_monthly AS "listenersMonthly",
  location, show_bio AS "showBio", notes, url,
  interview_cost::float AS "interviewCost", host_email AS "hostEmail",
  created_at AS "createdAt" FROM ib_shows`

async function upsertShow(s) {
  await pool.query(`
    INSERT INTO ib_shows (id,name,category,listeners_per_ep,listeners_monthly,location,show_bio,notes,url,interview_cost,host_email,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
      listeners_per_ep=EXCLUDED.listeners_per_ep, listeners_monthly=EXCLUDED.listeners_monthly,
      location=EXCLUDED.location, show_bio=EXCLUDED.show_bio, notes=EXCLUDED.notes, url=EXCLUDED.url,
      interview_cost=EXCLUDED.interview_cost, host_email=EXCLUDED.host_email, updated_at=NOW()`,
    [s.id, s.name || '', s.category || '', parseInt(s.listenersPerEp) || 0, parseInt(s.listenersMonthly) || 0,
     s.location || '', s.showBio || '', s.notes || '', s.url || '', parseFloat(s.interviewCost) || 0, s.hostEmail || ''])
}

// ── Shows ──
bookerRouter.get('/shows', async (req, res) => {
  try { res.json((await pool.query(SHOW_SELECT + ' ORDER BY created_at ASC')).rows) }
  catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.post('/shows', async (req, res) => {
  try { await upsertShow(req.body); res.json({ ok: true }) } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.post('/shows/bulk', async (req, res) => {
  try {
    const shows = req.body.shows || []
    for (const s of shows) await upsertShow(s)
    res.json({ ok: true, count: shows.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.delete('/shows/:id', async (req, res) => {
  try { await pool.query('DELETE FROM ib_shows WHERE id=$1', [req.params.id]); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.delete('/shows', async (req, res) => {
  try { await pool.query('DELETE FROM ib_shows'); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Briefs ──
bookerRouter.get('/briefs', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, data, updated_at FROM ib_briefs ORDER BY updated_at DESC')
    res.json(rows.map(r => ({ ...r.data, id: r.id, updatedAt: r.updated_at })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.post('/briefs', async (req, res) => {
  try {
    const b = req.body
    await pool.query(`INSERT INTO ib_briefs (id, brand_name, data, updated_at) VALUES ($1,$2,$3,NOW())
      ON CONFLICT (id) DO UPDATE SET brand_name=EXCLUDED.brand_name, data=EXCLUDED.data, updated_at=NOW()`,
      [b.id, b.brandName || '', JSON.stringify(b)])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.delete('/briefs/:id', async (req, res) => {
  try { await pool.query('DELETE FROM ib_briefs WHERE id=$1', [req.params.id]); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Offers (saved matches) ──
bookerRouter.get('/offers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, brand_name AS "brandName", brief, offer, created_at AS "createdAt" FROM ib_offers ORDER BY created_at DESC LIMIT 50')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.post('/offers', async (req, res) => {
  try {
    const { brief, offer } = req.body
    const { rows } = await pool.query('INSERT INTO ib_offers (brand_name, brief, offer) VALUES ($1,$2,$3) RETURNING id',
      [brief.brandName || '', JSON.stringify(brief), JSON.stringify(offer)])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})
bookerRouter.delete('/offers/:id', async (req, res) => {
  try { await pool.query('DELETE FROM ib_offers WHERE id=$1', [req.params.id]); res.json({ ok: true }) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── AI matching ──
bookerRouter.post('/match', async (req, res) => {
  req.setTimeout(120000); res.setTimeout(120000)
  const { shows, brief } = req.body
  if (!shows?.length) return res.status(400).json({ error: 'No shows in the interview library' })
  if (!brief?.brandName) return res.status(400).json({ error: 'No brief provided' })

  const words = [brief.brandName, brief.brandDesc, brief.category, brief.topics, brief.targetAudience, brief.guestBio, brief.notes]
    .join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 3)
  const budget = parseFloat(brief.budget) || 0
  const score = p => {
    let sc = 0
    const t = [p.name, p.category, p.showBio, p.notes].join(' ').toLowerCase()
    words.forEach(w => { if (t.includes(w)) sc += 2 })
    if (p.interviewCost > 0) sc += 2
    if (budget && p.interviewCost > budget) sc -= 6
    if (p.listenersPerEp > 0 || p.listenersMonthly > 0) sc += 2
    if (p.hostEmail) sc += 1
    if (p.showBio) sc += 1
    return sc
  }
  const candidates = shows.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).slice(0, 45).map(x => x.p)
  const tr = (s, n) => s && s.length > n ? s.slice(0, n) + '…' : (s || '')
  const list = candidates.map((p, i) =>
    `${i + 1}. "${p.name}" | category: ${p.category || 'unknown'} | ep_listeners: ${p.listenersPerEp || 'unknown'} | monthly: ${p.listenersMonthly || 'unknown'} | location: ${p.location || 'unknown'} | interview_cost: ${p.interviewCost > 0 ? '$' + p.interviewCost : 'unknown'} | bio: ${tr(p.showBio, 140)} | notes: ${tr(p.notes, 100)}`
  ).join('\n')

  const prompt = `You are a senior podcast booking strategist at a PR/media agency. Match this brand to the best podcasts to book interviews or sponsored episodes on.

BRIEF:
- Brand: ${brief.brandName}
- Industry: ${brief.category || 'unspecified'}
- About: ${brief.brandDesc || ''}
- Guest / spokesperson: ${brief.guestName || 'unspecified'} ${brief.guestBio ? '— ' + brief.guestBio : ''}
- Topics / talking points: ${brief.topics || 'unspecified'}
- Target audience: ${brief.targetAudience || 'unspecified'}
- Goal: ${brief.goal || 'awareness'}
- Format wanted: ${brief.format || 'interview or sponsored episode'}
- Number of bookings wanted: ${brief.numBookings || 'flexible'}
- Total budget: ${budget ? '$' + budget : 'unspecified'}
- Location preference: ${brief.locationPref || 'any'}
- Notes: ${brief.notes || 'none'}

AVAILABLE SHOWS (${candidates.length} pre-filtered from ${shows.length}):
${list}

RULES:
- Pick the best ${brief.numBookings || '5–10'} shows. Prefer relevance of topic and audience first, then reach, then cost.
- Keep the sum of known interview costs within the budget when a budget is given.
- Never invent facts about a show beyond the data above.
- Use the exact show name from the list.

Respond ONLY with valid JSON, no markdown:
{"summary":"2-3 sentence strategy","selections":[{"podcastName":"exact name","fitScore":8,"reason":"one sentence on why this show fits","pitchAngle":"the specific interview topic / angle to pitch the host","format":"interview"}]}
fitScore is 1-10. format is "interview" or "sponsored episode".`

  try {
    const r = await claudeWithRetry({ model: 'claude-opus-4-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
    const parsed = JSON.parse(r.content[0].text.replace(/```json|```/g, '').trim())
    const fee = parseFloat(brief.serviceFee) || 0
    const mult = 1 + fee / 100
    const selections = []
    for (const s of parsed.selections || []) {
      const n = (s.podcastName || '').toLowerCase()
      const pod = candidates.find(p => p.name.toLowerCase() === n) ||
                  candidates.find(p => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()))
      if (!pod) continue
      selections.push({
        ...s, podcastName: pod.name, id: pod.id,
        category: pod.category, listenersPerEp: pod.listenersPerEp, listenersMonthly: pod.listenersMonthly,
        location: pod.location, url: pod.url, hostEmail: pod.hostEmail,
        hostCost: pod.interviewCost || 0,
        price: pod.interviewCost > 0 ? Math.round(pod.interviewCost * mult) : 0, // client price incl. service fee
        included: true
      })
    }
    res.json({ summary: parsed.summary, selections })
  } catch (e) {
    console.error('Booker match error:', e)
    res.status(500).json({ error: e.message })
  }
})
