import pg from 'pg'

const { Pool } = pg

// Railway provides DATABASE_URL automatically when you add a Postgres plugin
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// Create tables if they don't exist
export async function initDB() {
  // Test connection first
  const client = await pool.connect()
  console.log('DB connected successfully')
  client.release()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shows (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      ad_network    TEXT DEFAULT '',
      category      TEXT DEFAULT '',
      listeners_per_ep   INTEGER DEFAULT 0,
      listeners_monthly  INTEGER DEFAULT 0,
      release_frequency  TEXT DEFAULT '',
      cpm           NUMERIC(10,2) DEFAULT 0,
      sponsorship_types  TEXT DEFAULT '',
      host_location TEXT DEFAULT '',
      demographics  TEXT DEFAULT '',
      url           TEXT DEFAULT '',
      description   TEXT DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plans (
      id          SERIAL PRIMARY KEY,
      brand_name  TEXT NOT NULL,
      brief       JSONB NOT NULL,
      plan        JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id           TEXT PRIMARY KEY,
      brand_name   TEXT NOT NULL,
      brand_desc   TEXT DEFAULT '',
      category     TEXT DEFAULT '',
      target_audience TEXT DEFAULT '',
      age_range    TEXT DEFAULT '',
      gender       TEXT DEFAULT 'all',
      budget       TEXT DEFAULT '',
      flight_weeks TEXT DEFAULT '4',
      campaign_goal TEXT DEFAULT 'awareness',
      notes        TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `)
  // Verify tables exist
  const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  console.log('✅ Database tables ready:', rows.map(r => r.table_name).join(', '))
}

// ── Shows ─────────────────────────────────────────────────────────────────────

export async function getAllShows() {
  const { rows } = await pool.query(`
    SELECT
      id, name,
      ad_network        AS "adNetwork",
      category,
      listeners_per_ep  AS "listenersPerEp",
      listeners_monthly AS "listenersMonthly",
      release_frequency AS "releaseFrequency",
      cpm::float,
      sponsorship_types AS "sponsorshipTypes",
      host_location     AS "hostLocation",
      demographics,
      url,
      description,
      created_at        AS "createdAt"
    FROM shows
    ORDER BY created_at ASC
  `)
  return rows
}

export async function upsertShow(show) {
  const { rows } = await pool.query(`
    INSERT INTO shows (
      id, name, ad_network, category,
      listeners_per_ep, listeners_monthly, release_frequency,
      cpm, sponsorship_types, host_location,
      demographics, url, description, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
    ON CONFLICT (id) DO UPDATE SET
      name              = EXCLUDED.name,
      ad_network        = EXCLUDED.ad_network,
      category          = EXCLUDED.category,
      listeners_per_ep  = EXCLUDED.listeners_per_ep,
      listeners_monthly = EXCLUDED.listeners_monthly,
      release_frequency = EXCLUDED.release_frequency,
      cpm               = EXCLUDED.cpm,
      sponsorship_types = EXCLUDED.sponsorship_types,
      host_location     = EXCLUDED.host_location,
      demographics      = EXCLUDED.demographics,
      url               = EXCLUDED.url,
      description       = EXCLUDED.description,
      updated_at        = NOW()
    RETURNING id
  `, [
    show.id,
    show.name || '',
    show.adNetwork || '',
    show.category || '',
    parseInt(show.listenersPerEp) || 0,
    parseInt(show.listenersMonthly) || 0,
    show.releaseFrequency || '',
    parseFloat(show.cpm) || 0,
    show.sponsorshipTypes || '',
    show.hostLocation || '',
    show.demographics || '',
    show.url || '',
    show.description || ''
  ])
  return rows[0]
}

export async function upsertShows(shows) {
  // Batch upsert — run in sequence to avoid conflicts
  for (const show of shows) {
    await upsertShow(show)
  }
  return shows.length
}

export async function deleteShow(id) {
  await pool.query('DELETE FROM shows WHERE id = $1', [id])
}

export async function deleteAllShows() {
  await pool.query('DELETE FROM shows')
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function savePlan(brief, plan) {
  const { rows } = await pool.query(
    'INSERT INTO plans (brand_name, brief, plan) VALUES ($1,$2,$3) RETURNING id, created_at',
    [brief.brandName, JSON.stringify(brief), JSON.stringify(plan)]
  )
  return rows[0]
}

export async function getPlans() {
  const { rows } = await pool.query(`
    SELECT id, brand_name AS "brandName", brief, plan, created_at AS "createdAt"
    FROM plans ORDER BY created_at DESC LIMIT 50
  `)
  return rows
}

export async function deletePlan(id) {
  await pool.query('DELETE FROM plans WHERE id = $1', [id])
}

// ── Briefs ────────────────────────────────────────────────────────────────────

export async function getAllBriefs() {
  const { rows } = await pool.query(`
    SELECT
      id,
      brand_name   AS "brandName",
      brand_desc   AS "brandDesc",
      category,
      target_audience AS "targetAudience",
      age_range    AS "ageRange",
      gender,
      budget,
      flight_weeks AS "flightWeeks",
      campaign_goal AS "campaignGoal",
      notes,
      created_at   AS "createdAt",
      updated_at   AS "updatedAt"
    FROM briefs
    ORDER BY updated_at DESC
  `)
  return rows
}

export async function upsertBrief(brief) {
  const { rows } = await pool.query(`
    INSERT INTO briefs (
      id, brand_name, brand_desc, category,
      target_audience, age_range, gender,
      budget, flight_weeks, campaign_goal, notes, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    ON CONFLICT (id) DO UPDATE SET
      brand_name      = EXCLUDED.brand_name,
      brand_desc      = EXCLUDED.brand_desc,
      category        = EXCLUDED.category,
      target_audience = EXCLUDED.target_audience,
      age_range       = EXCLUDED.age_range,
      gender          = EXCLUDED.gender,
      budget          = EXCLUDED.budget,
      flight_weeks    = EXCLUDED.flight_weeks,
      campaign_goal   = EXCLUDED.campaign_goal,
      notes           = EXCLUDED.notes,
      updated_at      = NOW()
    RETURNING id
  `, [
    brief.id,
    brief.brandName || '',
    brief.brandDesc || '',
    brief.category || '',
    brief.targetAudience || '',
    brief.ageRange || '',
    brief.gender || 'all',
    brief.budget || '',
    brief.flightWeeks || '4',
    brief.campaignGoal || 'awareness',
    brief.notes || ''
  ])
  return rows[0]
}

export async function deleteBrief(id) {
  await pool.query('DELETE FROM briefs WHERE id = $1', [id])
}

export default pool
