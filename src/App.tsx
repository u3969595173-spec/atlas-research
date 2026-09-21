import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownRight, Check, ChevronRight, CircleHelp, ClipboardCheck, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import './App.css'

type Classification = 'INTERESANTE' | 'REVISAR' | 'DESCARTADO'
type Match = { id: number; sport: string; event: string; oddsSportKey?: string; time: string; players: string; ranking: string; odds: number; classification: Classification; reason: string }
type DailyPlan = { bankroll: number; goal: number; riskPercent: number }
type DailyStats = { exposure: number; net: number; roi: number }
type LiveAnalysis = { source: { provider: string; sportKey: string; retrievedAt: string; requestsRemaining: string | null }; event: { home: string; away: string; commenceTime: string }; books: { house: string; updatedAt: string; outcomes: { participant: string; odds: number }[] }[]; verdict: string }
type FootballFixture = { id: number; home: string; away: string; time: string }

const leagueOptions: Record<string, { value: string; label: string }[]> = {
  FUTBOL: [{ value: 'premier_league', label: 'Premier League' }, { value: 'la_liga', label: 'LaLiga' }, { value: 'serie_a', label: 'Serie A' }, { value: 'bundesliga', label: 'Bundesliga' }, { value: 'ligue_1', label: 'Ligue 1' }],
  BALONCESTO: [{ value: 'nba', label: 'NBA' }],
  BEISBOL: [{ value: 'mlb', label: 'MLB' }],
  VOLEIBOL: [{ value: 'nations_league', label: 'Nations League' }],
}

const matches: Match[] = [
  { id: 1, sport: 'TENIS', event: 'ATP Chengdu', time: '13:00', players: 'L. Sonego vs Y. Wu', ranking: '#80 / #25', odds: 1.85, classification: 'INTERESANTE', reason: 'Peor ranking, favorito del mercado' },
  { id: 2, sport: 'TENIS', event: 'WTA Seoul', time: '15:30', players: 'M. Linette vs E. Raducanu', ranking: '#42 / #33', odds: 1.72, classification: 'REVISAR', reason: 'Superficie y descanso por contrastar' },
  { id: 3, sport: 'TENIS', event: 'ATP Chengdu', time: '16:00', players: 'T. Etcheverry vs D. Evans', ranking: '#39 / #161', odds: 1.34, classification: 'DESCARTADO', reason: 'Cuota fuera del rango objetivo' },
  { id: 4, sport: 'FUTBOL', event: 'Primera División', time: '18:00', players: 'Real Sociedad vs Getafe', ranking: '4º / 15º', odds: 1.78, classification: 'REVISAR', reason: 'Bajas confirmadas pendientes' },
  { id: 5, sport: 'TENIS', event: 'WTA Seoul', time: '18:30', players: 'V. Kudermetova vs M. Keys', ranking: '#76 / #18', odds: 1.91, classification: 'INTERESANTE', reason: 'Peor ranking, favorito del mercado' },
  { id: 6, sport: 'FUTBOL', event: 'Championship', time: '19:45', players: 'Coventry vs Bristol City', ranking: '9º / 12º', odds: 2.12, classification: 'DESCARTADO', reason: 'Cuota por encima del límite' },
  { id: 7, sport: 'BALONCESTO', event: 'Liga Endesa', time: '20:00', players: 'Joventut vs Zaragoza', ranking: '7º / 11º', odds: 1.62, classification: 'REVISAR', reason: 'Mercado con poca profundidad' },
  { id: 8, sport: 'TENIS', event: 'ATP Chengdu', time: '20:30', players: 'J. Thompson vs A. Bublik', ranking: '#29 / #24', odds: 1.96, classification: 'REVISAR', reason: 'Diferencia ranking insuficiente' },
  { id: 9, sport: 'FUTBOL', event: 'Serie A', time: '20:45', players: 'Torino vs Parma', ranking: '10º / 8º', odds: 1.88, classification: 'REVISAR', reason: 'Cambio de entrenador reciente' },
  { id: 10, sport: 'TENIS', event: 'WTA Seoul', time: '22:00', players: 'C. Bucsa vs D. Shnaider', ranking: '#70 / #19', odds: 2.04, classification: 'DESCARTADO', reason: 'Cuota por encima del límite' },
]
const label: Record<Classification, string> = { INTERESANTE: 'Interesante', REVISAR: 'Revisar', DESCARTADO: 'Descartado' }

function App() {
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  const workspaceId = 'personal-default'
  const [storedMatches, setStoredMatches] = useState(matches)
  const [activeMatchId, setActiveMatchId] = useState(1)
  const [filter, setFilter] = useState<Classification | 'TODOS'>('TODOS')
  const [selected, setSelected] = useState<number[]>([])
  const [analysisClosed, setAnalysisClosed] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>({ bankroll: 0, goal: 0, riskPercent: 5 })
  const [dailyStats, setDailyStats] = useState<DailyStats>({ exposure: 0, net: 0, roi: 0 })
  const [dailyResults, setDailyResults] = useState<Record<number, string>>({})
  const [sportKey, setSportKey] = useState('')
  const [liveAnalysis, setLiveAnalysis] = useState<LiveAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [newSport, setNewSport] = useState('FUTBOL')
  const [newPlayers, setNewPlayers] = useState('')
  const [newEvent, setNewEvent] = useState('')
  const [newOddsSportKey, setNewOddsSportKey] = useState('')
  const [footballLeague, setFootballLeague] = useState('la_liga')
  const [footballDate, setFootballDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [footballFixtures, setFootballFixtures] = useState<FootballFixture[]>([])
  const [fixturesLoading, setFixturesLoading] = useState(false)
  const [favoriteTeams, setFavoriteTeams] = useState('')
  const active = storedMatches.find((match) => Number(match.id) === Number(activeMatchId)) ?? storedMatches[0] ?? matches[0]
  const visible = filter === 'TODOS' ? storedMatches : storedMatches.filter((match) => match.classification === filter)
  useEffect(() => {
    if (!apiUrl) return
    fetch(`${apiUrl}/api/workspaces/${workspaceId}`).then(async (response) => {
      if (!response.ok) throw new Error('No se pudo cargar la lista')
      return response.json()
    }).then((data) => {
      const cloudMatches: Match[] = data.matches.map((match: Partial<Match>) => ({
        id: Number(match.id),
        sport: String(match.sport ?? 'PENDIENTE'),
        event: String(match.event ?? 'Evento pendiente'),
        oddsSportKey: String(match.oddsSportKey ?? ''),
        time: String(match.time ?? 'Pendiente'),
        players: String(match.players ?? 'Participantes pendientes'),
        ranking: String(match.ranking ?? 'Pendiente'),
        odds: Number(match.odds) || 0,
        classification: match.classification === 'INTERESANTE' || match.classification === 'DESCARTADO' ? match.classification : 'REVISAR',
        reason: String(match.reason ?? 'Datos necesarios para analizar'),
      }))
      setStoredMatches(cloudMatches)
      setSelected(data.selected.map(Number))
      setAnalysisClosed(data.analysisClosed)
      setFavoriteTeams(String(data.favoriteTeams ?? ''))
      if (cloudMatches.length) setActiveMatchId(cloudMatches[0].id)
    }).catch(() => setSyncError('No se pudo conectar con la nube. Revisa VITE_API_URL.'))
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/daily`).then(async (response) => {
      if (!response.ok) throw new Error()
      return response.json()
    }).then((data) => {
      setDailyPlan(data.plan)
      setDailyStats(data.stats)
      setDailyResults(Object.fromEntries(data.entries.map((entry: { matchId: number; result: string }) => [Number(entry.matchId), entry.result])))
    }).catch(() => setSyncError('No se pudo cargar el registro diario.'))
  }, [apiUrl])
  const toggleSelection = (id: number) => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < 5 && !analysisClosed ? [...selected, id] : selected
    setSelected(next)
    if (apiUrl && next !== selected) fetch(`${apiUrl}/api/workspaces/${workspaceId}/selections`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: next }) }).then((response) => { if (!response.ok) throw new Error() }).catch(() => setSyncError('No se pudo guardar la selección en la nube.'))
  }
  const closeAnalysis = () => {
    setAnalysisClosed(true)
    if (apiUrl) fetch(`${apiUrl}/api/workspaces/${workspaceId}/closed`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closed: true }) }).then((response) => { if (!response.ok) throw new Error() }).catch(() => { setAnalysisClosed(false); setSyncError('No se pudo cerrar el análisis en la nube.') })
  }
  const addMatch = () => {
    if (!newPlayers.trim() || !newEvent.trim() || analysisClosed) return
    const draft = { sport: newSport, event: newEvent.trim(), oddsSportKey: newOddsSportKey.trim(), time: 'Pendiente', players: newPlayers.trim(), ranking: 'Pendiente', odds: 0, classification: 'REVISAR' as Classification, reason: 'Datos necesarios para analizar' }
    if (!apiUrl) {
      const match = { ...draft, id: Date.now() }
      setStoredMatches([...storedMatches, match])
      setActiveMatchId(match.id)
      setNewPlayers(''); setNewEvent(''); setNewOddsSportKey(''); setShowAdd(false)
      return
    }
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((match) => { const newMatch = { ...match, id: Number(match.id) }; setStoredMatches([...storedMatches, newMatch]); setActiveMatchId(newMatch.id); setNewPlayers(''); setNewEvent(''); setNewOddsSportKey(''); setShowAdd(false) })
      .catch(() => setSyncError('No se pudo añadir el partido en la nube.'))
  }
  const loadSportFixtures = () => {
    if (!apiUrl) return
    setFixturesLoading(true); setFootballFixtures([])
    fetch(`${apiUrl}/api/sports/fixtures?sport=${newSport}&league=${footballLeague}&date=${footballDate}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data })
      .then((data) => {
        setFootballFixtures(data.fixtures)
        setNewEvent(data.league.name)
        setNewOddsSportKey(data.league.oddsSportKey)
      })
      .catch((error) => setSyncError(error.message || 'No se pudieron cargar los partidos.'))
      .finally(() => setFixturesLoading(false))
  }
  const selectSportFixture = (fixtureId: string) => {
    const fixture = footballFixtures.find((item) => item.id === Number(fixtureId))
    if (!fixture) return
    setNewPlayers(`${fixture.home} vs ${fixture.away}`)
  }
  const savePreferences = () => {
    if (!apiUrl) return
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favoriteTeams }) })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((data) => setFavoriteTeams(data.favoriteTeams))
      .catch(() => setSyncError('No se pudieron guardar tus equipos seguidos.'))
  }
  const reviewedMatches = storedMatches.filter((match) => selected.includes(Number(match.id)))
  const openReview = () => {
    setShowReview(true)
    window.setTimeout(() => window.scrollTo({ top: 70, behavior: 'smooth' }), 0)
  }
  const maxExposure = dailyPlan.bankroll * dailyPlan.riskPercent / 100
  const rawStakes = reviewedMatches.map((match) => dailyPlan.goal > 0 && match.odds > 1 ? dailyPlan.goal / reviewedMatches.length / (match.odds - 1) : 0)
  const requestedExposure = rawStakes.reduce((sum, stake) => sum + stake, 0)
  const scale = requestedExposure > maxExposure && requestedExposure > 0 ? maxExposure / requestedExposure : 1
  const plannedEntries = reviewedMatches.map((match, index) => ({ matchId: match.id, stake: Number((rawStakes[index] * scale).toFixed(2)), result: dailyResults[match.id] ?? 'PENDIENTE', odds: match.odds }))
  const plannedExposure = plannedEntries.reduce((sum, entry) => sum + entry.stake, 0)
  const plannedPotential = plannedEntries.reduce((sum, entry) => sum + entry.stake * (entry.odds - 1), 0)
  const calculatedNet = plannedEntries.reduce((sum, entry) => entry.result === 'GANADO' ? sum + entry.stake * (entry.odds - 1) : entry.result === 'PERDIDO' ? sum - entry.stake : sum, 0)
  const followedTeams = favoriteTeams.split(',').map((team) => team.trim().toLowerCase()).filter(Boolean)
  const followsActive = followedTeams.some((team) => active.players.toLowerCase().includes(team))
  const saveDailyPlan = () => {
    if (!apiUrl) return
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/daily/plan`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dailyPlan) })
      .then(async (response) => { if (!response.ok) throw new Error(); return fetch(`${apiUrl}/api/workspaces/${workspaceId}/daily/records`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: plannedEntries }) }) })
      .then((response) => { if (!response.ok) throw new Error(); setDailyStats({ exposure: plannedExposure, net: calculatedNet, roi: plannedExposure ? calculatedNet / plannedExposure * 100 : 0 }) })
      .catch(() => setSyncError('No se pudo guardar el plan diario. Revisa el límite de exposición.'))
  }
  const loadRealAnalysis = () => {
    if (!apiUrl) return
    setAnalysisLoading(true); setLiveAnalysis(null)
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/matches/${active.id}/analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sportKey: sportKey.trim() || undefined }) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data })
      .then(setLiveAnalysis).catch((error) => setSyncError(error.message || 'No se pudo consultar el análisis real.')).finally(() => setAnalysisLoading(false))
  }
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Atlas <strong>Research</strong></span></div><div className="analysis-status"><span className="status-dot" /> Análisis de hoy <b>{analysisClosed ? 'cerrado' : 'en curso'}</b></div><div className="top-actions"><button className="icon-button" aria-label="Buscar"><Search size={18} /></button><button className="avatar" aria-label="Perfil">MR</button></div></header>
    <section className="workspace-header"><div><p className="eyebrow">LISTA PERSONAL · 21 SEPT 2026</p><h1>Partidos seleccionados</h1><p className="subhead">Analiza solo esta lista. La aplicación no busca eventos adicionales ni fuerza una selección.</p></div><div className="header-actions"><button className="secondary-button" onClick={() => setShowAdd(true)} disabled={analysisClosed}><Plus size={17} /> Añadir partido</button><button className="primary-button" onClick={closeAnalysis} disabled={analysisClosed}><LockKeyhole size={16} /> {analysisClosed ? 'Análisis cerrado' : 'Cerrar análisis'}</button></div></section>
    {syncError && <section className="cloud-error">{syncError}</section>}
    <section className="preferences-panel"><label>Equipos que sigues<input value={favoriteTeams} onChange={(event) => setFavoriteTeams(event.target.value)} placeholder="Ej.: Real Madrid, Arsenal, Inter" /></label><button className="secondary-button" onClick={savePreferences}>Guardar equipos</button><span>Se usan solo como contexto para organizar tus revisiones.</span></section>
    {showAdd && <section className="add-panel"><div className="add-fields"><select value={newSport} onChange={(event) => { const sport = event.target.value; setNewSport(sport); setFootballLeague(leagueOptions[sport][0].value); setFootballFixtures([]); setNewPlayers(''); setNewEvent(''); setNewOddsSportKey('') }} aria-label="Deporte"><option>FUTBOL</option><option>BALONCESTO</option><option>BEISBOL</option><option>VOLEIBOL</option></select><select value={footballLeague} onChange={(event) => setFootballLeague(event.target.value)} aria-label="Competición">{leagueOptions[newSport].map((league) => <option value={league.value} key={league.value}>{league.label}</option>)}</select><input type="date" value={footballDate} onChange={(event) => setFootballDate(event.target.value)} aria-label="Fecha" /><button className="add-submit" onClick={loadSportFixtures} disabled={fixturesLoading}>{fixturesLoading ? 'Buscando...' : 'Ver partidos'}</button>{footballFixtures.length > 0 && <select defaultValue="" onChange={(event) => selectSportFixture(event.target.value)} aria-label="Partido"><option value="" disabled>Elige un partido</option>{footballFixtures.map((fixture) => <option value={fixture.id} key={fixture.id}>{fixture.home} vs {fixture.away}</option>)}</select>}{footballFixtures.length === 0 && !fixturesLoading && <span>Elige deporte, liga y fecha para cargar partidos.</span>}<button className="add-submit" onClick={addMatch} disabled={!newPlayers.trim() || !newEvent.trim() || !newOddsSportKey.trim()}>Añadir</button></div><button className="icon-button" aria-label="Cerrar" onClick={() => setShowAdd(false)}><X size={18} /></button></section>}
    {showReview && <section className="review-panel"><div><p className="eyebrow">MIS CANDIDATOS · {selected.length}/5</p><h2>Revisión antes de decidir</h2><p>Estos candidatos no son apuestas ni implican una recomendación.</p><ul>{reviewedMatches.map((match) => { const entry = plannedEntries.find((item) => item.matchId === match.id); return <li key={match.id}><b>{match.players}</b><span>{match.event} · Cuota {Number(match.odds || 0).toFixed(2)} · Exposición {entry?.stake.toFixed(2) ?? '0.00'}</span><select value={dailyResults[match.id] ?? 'PENDIENTE'} onChange={(event) => setDailyResults({ ...dailyResults, [match.id]: event.target.value })}><option value="PENDIENTE">Pendiente</option><option value="GANADO">Ganado</option><option value="PERDIDO">Perdido</option><option value="NULO">Nulo</option></select></li>})}</ul><button className="review-save" onClick={saveDailyPlan}>Guardar plan y resultados</button></div><button className="icon-button" aria-label="Cerrar revisión" onClick={() => setShowReview(false)}><X size={18} /></button></section>}
    <section className="content-grid">
      <aside className="match-list"><div className="list-header"><span>{storedMatches.length} PARTIDOS</span><button className="filter-button"><SlidersHorizontal size={15} /> Filtros</button></div><div className="filter-tabs">{(['TODOS', 'INTERESANTE', 'REVISAR', 'DESCARTADO'] as const).map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'TODOS' ? 'Todos' : label[item]}</button>)}</div><div className="matches">{visible.map((match) => <button className={`match-row ${Number(activeMatchId) === Number(match.id) ? 'selected' : ''}`} onClick={() => setActiveMatchId(Number(match.id))} key={match.id}><span className={`class-dot ${match.classification.toLowerCase()}`} /><span className="match-main"><span className="match-meta">{match.sport} · {match.time}</span><b>{match.players}</b><span className="match-reason">{match.reason}</span></span><ChevronRight size={17} /></button>)}</div></aside>
      <section className="analysis-panel"><div className="analysis-topline"><span>{active.event} · Hoy {active.time}</span><span className={`classification ${active.classification.toLowerCase()}`}>{label[active.classification] ?? 'Revisar'}</span></div><div className="title-row"><div><h2>{active.players}</h2><p>Mercado: ganador del partido</p>{followsActive && <small className="followed-context">Equipo que sigues: contexto personal, no recomendación.</small>}</div><button className={`selection-button ${selected.includes(Number(active.id)) ? 'is-selected' : ''}`} onClick={() => toggleSelection(Number(active.id))} disabled={analysisClosed || (!selected.includes(Number(active.id)) && selected.length >= 5)}>{selected.includes(Number(active.id)) ? <><Check size={16} /> Guardado para revisión</> : <><Plus size={16} /> Guardar para revisión</>}</button></div><div className="real-analysis"><div><b>Consultar datos reales</b><span>Cuotas verificadas solo para este partido.</span></div><input value={sportKey} onChange={(event) => setSportKey(event.target.value)} placeholder="Clave The Odds API (opcional)" /><button onClick={loadRealAnalysis} disabled={analysisLoading}><RefreshCw size={15} /> {analysisLoading ? 'Consultando' : 'Actualizar'}</button></div>{liveAnalysis && <section className="live-result"><div><b>{liveAnalysis.verdict}</b><span>{liveAnalysis.source.provider} · {liveAnalysis.source.sportKey} · {new Date(liveAnalysis.source.retrievedAt).toLocaleString()}</span></div><div className="live-books">{liveAnalysis.books.map((book) => <div key={book.house}><b>{book.house}</b><span>{book.outcomes.map((outcome) => `${outcome.participant}: ${outcome.odds.toFixed(2)}`).join(' · ')}</span></div>)}</div></section>}
        <div className="callout interest-callout"><CircleHelp size={19} /><div><b>Señal para investigar, no una recomendación.</b><span>El jugador de peor ranking aparece como favorito con cuota dentro del rango objetivo.</span></div></div>
        <div className="metric-grid"><div><span>RANKING</span><b>{active.ranking}</b><small>Diferencia: 55 puestos</small></div><div><span>CUOTA ACTUAL</span><b>{Number(active.odds || 0).toFixed(2)}</b><small>Rango permitido: 1.40 - 2.00</small></div><div><span>MOVIMIENTO</span><b className="movement"><ArrowDownRight size={18} /> 1.98 → {Number(active.odds || 0).toFixed(2)}</b><small>Desde apertura · ejemplo</small></div><div><span>CONFIANZA DEL DATO</span><b>Media</b><small>Fuentes por confirmar</small></div></div>
        <div className="analysis-columns"><section><h3>Por qué el mercado puede favorecerlo</h3><ul className="evidence-list positive"><li>Mejor rendimiento histórico en pista dura.</li><li>Rival con carga de partidos en los últimos 7 días.</li><li>La cuota inicial bajó en varias casas.</li></ul></section><section><h3>Qué contradice la hipótesis</h3><ul className="evidence-list negative"><li>El rival mantiene un ranking considerablemente superior.</li><li>No hay confirmación independiente de molestias físicas.</li><li>H2H limitado; no permite una conclusión sólida.</li></ul></section></div>
        <section className="odds-section"><div className="section-heading"><div><h3>Cuotas y trazabilidad</h3><p>Datos de muestra. Conecta fuentes verificadas antes de decidir.</p></div><span className="data-badge"><ShieldCheck size={14} /> Requiere verificación</span></div><div className="odds-table"><div><span>Casa</span><span>Apertura</span><span>Actual</span></div><div><b>Casa A</b><span>1.98</span><strong>1.85</strong></div><div><b>Casa B</b><span>1.94</span><strong>1.87</strong></div><div><b>Casa C</b><span>2.01</span><strong>1.91</strong></div></div></section>
        <section className="anomaly"><AlertTriangle size={19} /><div><b>ANOMALÍA — REQUIERE INVESTIGACIÓN</b><p>Diferencia de 0.06 entre la mejor y la peor cuota disponible. Por sí sola no indica un resultado ni una irregularidad.</p></div></section><section className="conclusion"><ClipboardCheck size={21} /><div><span>DECISIÓN ACTUAL</span><b>NO BET — NO JUGAR ESTE PARTIDO</b><p>No hay información verificada suficiente para recomendar un mercado ni un participante. Guardarlo solo permite revisarlo más tarde.</p></div></section>
      </section>
      <aside className="control-panel"><div className="control-title"><ShieldCheck size={20} /><div><h2>Control personal</h2><p>Plan y estadísticas de hoy</p></div></div><div className="bankroll-form"><label>Bankroll disponible<input type="number" min="0" value={dailyPlan.bankroll || ''} onChange={(event) => setDailyPlan({ ...dailyPlan, bankroll: Number(event.target.value) })} /></label><label>Objetivo orientativo<input type="number" min="0" value={dailyPlan.goal || ''} onChange={(event) => setDailyPlan({ ...dailyPlan, goal: Number(event.target.value) })} /></label><label>Riesgo máximo (%)<input type="number" min="1" max="10" value={dailyPlan.riskPercent} onChange={(event) => setDailyPlan({ ...dailyPlan, riskPercent: Number(event.target.value) })} /></label></div><div className="selection-count"><span>CANDIDATOS</span><b>{selected.length}<small> / 5 máximo</small></b><div className="progress"><i style={{ width: `${(selected.length / 5) * 100}%` }} /></div></div><div className="daily-metrics"><span>Exposición máxima <b>{maxExposure.toFixed(2)}</b></span><span>Planificada <b>{plannedExposure.toFixed(2)}</b></span><span>Ganancia potencial <b>{plannedPotential.toFixed(2)}</b></span><span>Resultado del día <b className={dailyStats.net < 0 ? 'negative' : ''}>{dailyStats.net.toFixed(2)} · ROI {dailyStats.roi.toFixed(1)}%</b></span></div>{requestedExposure > maxExposure && selected.length > 0 && <div className="risk-warning">El objetivo supera el riesgo máximo. El plan se reduce; no garantiza el objetivo.</div>}<ul className="rule-list"><li><Check size={16} /> Sin apuestas en vivo</li><li><Check size={16} /> Sin combinadas</li><li><Check size={16} /> Sin perseguir pérdidas</li><li><Check size={16} /> Máximo cinco candidatos</li><li className={analysisClosed ? 'locked-rule' : ''}>{analysisClosed ? <LockKeyhole size={16} /> : <Check size={16} />} {analysisClosed ? 'Lista bloqueada' : 'Lista aún editable'}</li></ul><button className="review-button" onClick={saveDailyPlan} disabled={selected.length === 0 || dailyPlan.bankroll <= 0}>Guardar plan diario</button><button className="secondary-review" onClick={openReview} disabled={selected.length === 0}>Revisar mis {selected.length} candidatos</button></aside>
    </section><footer>Atlas Research es una herramienta de análisis y control personal. No garantiza resultados ni sustituye una decisión responsable.</footer>
  </main>
}
export default App