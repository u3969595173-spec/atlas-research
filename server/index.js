import cors from 'cors'
import express from 'express'
import pg from 'pg'

const { Pool } = pg
const app = express()
const port = process.env.PORT || 10000
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } })

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }))
app.use(express.json())

const seedMatches = [
  ['TENIS', 'ATP Chengdu', '13:00', 'L. Sonego vs Y. Wu', '#80 / #25', 1.85, 'INTERESANTE', 'Peor ranking, favorito del mercado'],
  ['TENIS', 'WTA Seoul', '15:30', 'M. Linette vs E. Raducanu', '#42 / #33', 1.72, 'REVISAR', 'Superficie y descanso por contrastar'],
  ['TENIS', 'ATP Chengdu', '16:00', 'T. Etcheverry vs D. Evans', '#39 / #161', 1.34, 'DESCARTADO', 'Cuota fuera del rango objetivo'],
]

async function prepareDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, analysis_closed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS matches (id BIGSERIAL PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, sport TEXT NOT NULL, event TEXT NOT NULL, match_time TEXT NOT NULL, players TEXT NOT NULL, ranking TEXT NOT NULL, odds NUMERIC(5,2) NOT NULL, classification TEXT NOT NULL CHECK (classification IN ('INTERESANTE', 'REVISAR', 'DESCARTADO')), reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS selections (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (workspace_id, match_id));
    CREATE TABLE IF NOT EXISTS daily_plans (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, plan_date DATE NOT NULL, bankroll NUMERIC(12,2) NOT NULL DEFAULT 0, goal NUMERIC(12,2) NOT NULL DEFAULT 0, risk_percent NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (risk_percent > 0 AND risk_percent <= 10), PRIMARY KEY (workspace_id, plan_date));
    CREATE TABLE IF NOT EXISTS daily_records (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, plan_date DATE NOT NULL, match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE, stake NUMERIC(12,2) NOT NULL CHECK (stake >= 0), result TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (result IN ('PENDIENTE', 'GANADO', 'PERDIDO', 'NULO')), PRIMARY KEY (workspace_id, plan_date, match_id));`)
}

async function ensureWorkspace(id) {
  const result = await pool.query('INSERT INTO workspaces (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING analysis_closed', [id])
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM matches WHERE workspace_id = $1', [id])
  if (count.rows[0].count === 0) {
    for (const match of seedMatches) await pool.query('INSERT INTO matches (workspace_id, sport, event, match_time, players, ranking, odds, classification, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, ...match])
  }
  return result.rows[0]
}

app.get('/health', async (_request, response) => { await pool.query('SELECT 1'); response.json({ status: 'ok' }) })
app.get('/api/providers/status', (_request, response) => {
  response.json({
    odds: Boolean(process.env.ODDS_API_KEY),
    apiSports: Boolean(process.env.API_SPORTS_KEY),
    configuredSports: ['TENIS', 'FUTBOL', 'BALONCESTO', 'BEISBOL', 'VOLEIBOL'],
    note: 'Las claves no se exponen; solo se informa si están configuradas.',
  })
})
const normalizeName = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const defaultOddsSport = { FUTBOL: 'soccer_spain_la_liga', BALONCESTO: 'basketball_nba', BEISBOL: 'baseball_mlb' }

app.post('/api/workspaces/:workspaceId/matches/:matchId/analysis', async (request, response) => {
  await ensureWorkspace(request.params.workspaceId)
  if (!process.env.ODDS_API_KEY) return response.status(503).json({ error: 'The Odds API no está configurada.' })
  const matchResult = await pool.query('SELECT id, sport, event, players FROM matches WHERE id = $1 AND workspace_id = $2', [request.params.matchId, request.params.workspaceId])
  if (!matchResult.rows.length) return response.status(404).json({ error: 'Partido no encontrado.' })
  const match = matchResult.rows[0]
  const sportKey = request.body.sportKey || defaultOddsSport[match.sport]
  if (!sportKey) return response.status(400).json({ error: 'Indica el identificador de competición de The Odds API para este deporte.' })
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds/`)
  url.search = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY, regions: 'eu', markets: 'h2h', oddsFormat: 'decimal' }).toString()
  const oddsResponse = await fetch(url)
  if (!oddsResponse.ok) return response.status(oddsResponse.status).json({ error: 'No se pudieron consultar las cuotas del proveedor.' })
  const events = await oddsResponse.json()
  const [first, second] = match.players.split(/\s+vs\.?\s+/i).map(normalizeName)
  const event = events.find((item) => {
    const home = normalizeName(item.home_team)
    const away = normalizeName(item.away_team)
    return (home === first && away === second) || (home === second && away === first)
  })
  if (!event) return response.status(404).json({ error: 'No se encontró una cuota verificable para este partido en la competición indicada.', source: { provider: 'The Odds API', sportKey } })
  const books = event.bookmakers.flatMap((bookmaker) => bookmaker.markets.filter((market) => market.key === 'h2h').map((market) => ({ house: bookmaker.title, updatedAt: market.last_update, outcomes: market.outcomes.map((outcome) => ({ participant: outcome.name, odds: outcome.price })) })))
  response.json({
    source: { provider: 'The Odds API', sportKey, retrievedAt: new Date().toISOString(), requestsRemaining: oddsResponse.headers.get('x-requests-remaining') },
    event: { home: event.home_team, away: event.away_team, commenceTime: event.commence_time },
    books,
    verdict: books.length ? 'DATOS REALES DISPONIBLES — REQUIERE REVISIÓN' : 'NO BET — SIN CUOTAS VERIFICABLES',
  })
})
app.get('/api/workspaces/:workspaceId', async (request, response) => {
  const workspace = await ensureWorkspace(request.params.workspaceId)
  const matches = await pool.query('SELECT id, sport, event, match_time AS time, players, ranking, odds::float, classification, reason FROM matches WHERE workspace_id = $1 ORDER BY id', [request.params.workspaceId])
  const selections = await pool.query('SELECT match_id FROM selections WHERE workspace_id = $1 ORDER BY created_at', [request.params.workspaceId])
  response.json({ analysisClosed: workspace.analysis_closed, matches: matches.rows.map((match) => ({ ...match, id: Number(match.id) })), selected: selections.rows.map((row) => Number(row.match_id)) })
})
app.get('/api/workspaces/:workspaceId/daily', async (request, response) => {
  await ensureWorkspace(request.params.workspaceId)
  const date = new Date().toISOString().slice(0, 10)
  await pool.query('INSERT INTO daily_plans (workspace_id, plan_date) VALUES ($1, $2) ON CONFLICT DO NOTHING', [request.params.workspaceId, date])
  const plan = await pool.query('SELECT bankroll::float, goal::float, risk_percent::float AS "riskPercent" FROM daily_plans WHERE workspace_id = $1 AND plan_date = $2', [request.params.workspaceId, date])
  const entries = await pool.query(`SELECT record.match_id AS "matchId", record.stake::float AS stake, record.result, match.odds::float AS odds
    FROM daily_records record JOIN matches match ON match.id = record.match_id WHERE record.workspace_id = $1 AND record.plan_date = $2`, [request.params.workspaceId, date])
  const stats = entries.rows.reduce((total, entry) => {
    total.exposure += entry.stake
    if (entry.result === 'GANADO') total.net += entry.stake * (entry.odds - 1)
    if (entry.result === 'PERDIDO') total.net -= entry.stake
    return total
  }, { exposure: 0, net: 0 })
  response.json({ plan: plan.rows[0], entries: entries.rows, stats: { ...stats, roi: stats.exposure ? (stats.net / stats.exposure) * 100 : 0 } })
})
app.put('/api/workspaces/:workspaceId/daily/plan', async (request, response) => {
  await ensureWorkspace(request.params.workspaceId)
  const bankroll = Number(request.body.bankroll)
  const goal = Number(request.body.goal)
  const riskPercent = Number(request.body.riskPercent)
  if (![bankroll, goal, riskPercent].every(Number.isFinite) || bankroll < 0 || goal < 0 || riskPercent <= 0 || riskPercent > 10) return response.status(400).json({ error: 'Plan diario no válido.' })
  const date = new Date().toISOString().slice(0, 10)
  const result = await pool.query(`INSERT INTO daily_plans (workspace_id, plan_date, bankroll, goal, risk_percent) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (workspace_id, plan_date) DO UPDATE SET bankroll = EXCLUDED.bankroll, goal = EXCLUDED.goal, risk_percent = EXCLUDED.risk_percent RETURNING bankroll::float, goal::float, risk_percent::float AS "riskPercent"`, [request.params.workspaceId, date, bankroll, goal, riskPercent])
  response.json({ plan: result.rows[0] })
})
app.put('/api/workspaces/:workspaceId/daily/records', async (request, response) => {
  await ensureWorkspace(request.params.workspaceId)
  const date = new Date().toISOString().slice(0, 10)
  const entries = request.body.entries ?? []
  if (!Array.isArray(entries) || entries.length > 5) return response.status(400).json({ error: 'Máximo de cinco registros diarios.' })
  const plan = await pool.query('SELECT bankroll::float, risk_percent::float AS "riskPercent" FROM daily_plans WHERE workspace_id = $1 AND plan_date = $2', [request.params.workspaceId, date])
  const maxExposure = (plan.rows[0]?.bankroll ?? 0) * (plan.rows[0]?.riskPercent ?? 5) / 100
  const exposure = entries.reduce((sum, entry) => sum + Number(entry.stake || 0), 0)
  if (!Number.isFinite(exposure) || exposure > maxExposure + 0.001) return response.status(400).json({ error: 'La exposición supera el límite diario.' })
  await pool.query('DELETE FROM daily_records WHERE workspace_id = $1 AND plan_date = $2', [request.params.workspaceId, date])
  for (const entry of entries) await pool.query('INSERT INTO daily_records (workspace_id, plan_date, match_id, stake, result) VALUES ($1,$2,$3,$4,$5)', [request.params.workspaceId, date, Number(entry.matchId), Number(entry.stake), ['GANADO', 'PERDIDO', 'NULO'].includes(entry.result) ? entry.result : 'PENDIENTE'])
  response.json({ entries })
})
app.post('/api/workspaces/:workspaceId/matches', async (request, response) => {
  const workspace = await ensureWorkspace(request.params.workspaceId)
  if (workspace.analysis_closed) return response.status(409).json({ error: 'La lista está cerrada.' })
  const { sport, event, time, players, ranking = 'Pendiente', odds = 0, classification = 'REVISAR', reason = 'Datos necesarios para analizar' } = request.body
  if (!event || !players || !time || !sport) return response.status(400).json({ error: 'Faltan datos obligatorios del partido.' })
  const result = await pool.query('INSERT INTO matches (workspace_id, sport, event, match_time, players, ranking, odds, classification, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, sport, event, match_time AS time, players, ranking, odds::float, classification, reason', [request.params.workspaceId, sport, event, time, players, ranking, odds, classification, reason])
  response.status(201).json(result.rows[0])
})
app.put('/api/workspaces/:workspaceId/closed', async (request, response) => {
  await ensureWorkspace(request.params.workspaceId)
  const result = await pool.query('UPDATE workspaces SET analysis_closed = $2 WHERE id = $1 RETURNING analysis_closed', [request.params.workspaceId, Boolean(request.body.closed)])
  response.json({ analysisClosed: result.rows[0].analysis_closed })
})
app.put('/api/workspaces/:workspaceId/selections', async (request, response) => {
  const workspace = await ensureWorkspace(request.params.workspaceId)
  const selected = [...new Set(request.body.selected ?? [])].map(Number)
  if (workspace.analysis_closed) return response.status(409).json({ error: 'El análisis está cerrado.' })
  if (selected.length > 5) return response.status(400).json({ error: 'Máximo de cinco candidatos.' })
  const valid = await pool.query('SELECT id FROM matches WHERE workspace_id = $1 AND id = ANY($2::bigint[])', [request.params.workspaceId, selected])
  if (valid.rows.length !== selected.length) return response.status(400).json({ error: 'Selección no válida.' })
  await pool.query('DELETE FROM selections WHERE workspace_id = $1', [request.params.workspaceId])
  for (const matchId of selected) await pool.query('INSERT INTO selections (workspace_id, match_id) VALUES ($1, $2)', [request.params.workspaceId, matchId])
  response.json({ selected })
})

prepareDatabase().then(() => app.listen(port, () => console.log(`API listening on ${port}`))).catch((error) => { console.error(error); process.exit(1) })