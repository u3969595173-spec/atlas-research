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
    CREATE TABLE IF NOT EXISTS selections (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (workspace_id, match_id));`)
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
app.get('/api/workspaces/:workspaceId', async (request, response) => {
  const workspace = await ensureWorkspace(request.params.workspaceId)
  const matches = await pool.query('SELECT id, sport, event, match_time AS time, players, ranking, odds::float, classification, reason FROM matches WHERE workspace_id = $1 ORDER BY id', [request.params.workspaceId])
  const selections = await pool.query('SELECT match_id FROM selections WHERE workspace_id = $1 ORDER BY created_at', [request.params.workspaceId])
  response.json({ analysisClosed: workspace.analysis_closed, matches: matches.rows.map((match) => ({ ...match, id: Number(match.id) })), selected: selections.rows.map((row) => Number(row.match_id)) })
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