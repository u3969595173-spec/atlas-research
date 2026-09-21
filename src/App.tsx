import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownRight, Check, ChevronRight, CircleHelp, ClipboardCheck, LockKeyhole, Plus, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import './App.css'

type Classification = 'INTERESANTE' | 'REVISAR' | 'DESCARTADO'
type Match = { id: number; sport: string; event: string; time: string; players: string; ranking: string; odds: number; classification: Classification; reason: string }

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
  const [newPlayers, setNewPlayers] = useState('')
  const [newEvent, setNewEvent] = useState('')
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
      if (cloudMatches.length) setActiveMatchId(cloudMatches[0].id)
    }).catch(() => setSyncError('No se pudo conectar con la nube. Revisa VITE_API_URL.'))
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
    const draft = { sport: 'TENIS', event: newEvent.trim(), time: 'Pendiente', players: newPlayers.trim(), ranking: 'Pendiente', odds: 0, classification: 'REVISAR' as Classification, reason: 'Datos necesarios para analizar' }
    if (!apiUrl) {
      const match = { ...draft, id: Date.now() }
      setStoredMatches([...storedMatches, match])
      setActiveMatchId(match.id)
      setNewPlayers(''); setNewEvent(''); setShowAdd(false)
      return
    }
    fetch(`${apiUrl}/api/workspaces/${workspaceId}/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((match) => { const newMatch = { ...match, id: Number(match.id) }; setStoredMatches([...storedMatches, newMatch]); setActiveMatchId(newMatch.id); setNewPlayers(''); setNewEvent(''); setShowAdd(false) })
      .catch(() => setSyncError('No se pudo añadir el partido en la nube.'))
  }
  const reviewedMatches = storedMatches.filter((match) => selected.includes(match.id))
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Atlas <strong>Research</strong></span></div><div className="analysis-status"><span className="status-dot" /> Análisis de hoy <b>{analysisClosed ? 'cerrado' : 'en curso'}</b></div><div className="top-actions"><button className="icon-button" aria-label="Buscar"><Search size={18} /></button><button className="avatar" aria-label="Perfil">MR</button></div></header>
    <section className="workspace-header"><div><p className="eyebrow">LISTA PERSONAL · 21 SEPT 2026</p><h1>Partidos seleccionados</h1><p className="subhead">Analiza solo esta lista. La aplicación no busca eventos adicionales ni fuerza una selección.</p></div><div className="header-actions"><button className="secondary-button" onClick={() => setShowAdd(true)} disabled={analysisClosed}><Plus size={17} /> Añadir partido</button><button className="primary-button" onClick={closeAnalysis} disabled={analysisClosed}><LockKeyhole size={16} /> {analysisClosed ? 'Análisis cerrado' : 'Cerrar análisis'}</button></div></section>
    {syncError && <section className="cloud-error">{syncError}</section>}
    {showAdd && <section className="add-panel"><div className="add-fields"><input value={newPlayers} onChange={(event) => setNewPlayers(event.target.value)} placeholder="Participantes o equipos" autoFocus /><input value={newEvent} onChange={(event) => setNewEvent(event.target.value)} placeholder="Torneo o competición" /><button className="add-submit" onClick={addMatch} disabled={!newPlayers.trim() || !newEvent.trim()}>Añadir</button></div><button className="icon-button" aria-label="Cerrar" onClick={() => setShowAdd(false)}><X size={18} /></button></section>}
    {showReview && <section className="review-panel"><div><p className="eyebrow">MIS CANDIDATOS · {selected.length}/5</p><h2>Revisión antes de decidir</h2><p>Estos candidatos no son apuestas ni implican una recomendación.</p><ul>{reviewedMatches.map((match) => <li key={match.id}><b>{match.players}</b><span>{match.event} · Cuota {Number(match.odds || 0).toFixed(2)} · {label[match.classification] ?? 'Revisar'}</span></li>)}</ul></div><button className="icon-button" aria-label="Cerrar revisión" onClick={() => setShowReview(false)}><X size={18} /></button></section>}
    <section className="content-grid">
      <aside className="match-list"><div className="list-header"><span>{storedMatches.length} PARTIDOS</span><button className="filter-button"><SlidersHorizontal size={15} /> Filtros</button></div><div className="filter-tabs">{(['TODOS', 'INTERESANTE', 'REVISAR', 'DESCARTADO'] as const).map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'TODOS' ? 'Todos' : label[item]}</button>)}</div><div className="matches">{visible.map((match) => <button className={`match-row ${Number(activeMatchId) === Number(match.id) ? 'selected' : ''}`} onClick={() => setActiveMatchId(Number(match.id))} key={match.id}><span className={`class-dot ${match.classification.toLowerCase()}`} /><span className="match-main"><span className="match-meta">{match.sport} · {match.time}</span><b>{match.players}</b><span className="match-reason">{match.reason}</span></span><ChevronRight size={17} /></button>)}</div></aside>
      <section className="analysis-panel"><div className="analysis-topline"><span>{active.event} · Hoy {active.time}</span><span className={`classification ${active.classification.toLowerCase()}`}>{label[active.classification] ?? 'Revisar'}</span></div><div className="title-row"><div><h2>{active.players}</h2><p>Mercado: ganador del partido</p></div><button className={`selection-button ${selected.includes(Number(active.id)) ? 'is-selected' : ''}`} onClick={() => toggleSelection(Number(active.id))} disabled={analysisClosed || (!selected.includes(Number(active.id)) && selected.length >= 5)}>{selected.includes(Number(active.id)) ? <><Check size={16} /> Guardado para revisión</> : <><Plus size={16} /> Guardar para revisión</>}</button></div>
        <div className="callout interest-callout"><CircleHelp size={19} /><div><b>Señal para investigar, no una recomendación.</b><span>El jugador de peor ranking aparece como favorito con cuota dentro del rango objetivo.</span></div></div>
        <div className="metric-grid"><div><span>RANKING</span><b>{active.ranking}</b><small>Diferencia: 55 puestos</small></div><div><span>CUOTA ACTUAL</span><b>{Number(active.odds || 0).toFixed(2)}</b><small>Rango permitido: 1.40 - 2.00</small></div><div><span>MOVIMIENTO</span><b className="movement"><ArrowDownRight size={18} /> 1.98 → {Number(active.odds || 0).toFixed(2)}</b><small>Desde apertura · ejemplo</small></div><div><span>CONFIANZA DEL DATO</span><b>Media</b><small>Fuentes por confirmar</small></div></div>
        <div className="analysis-columns"><section><h3>Por qué el mercado puede favorecerlo</h3><ul className="evidence-list positive"><li>Mejor rendimiento histórico en pista dura.</li><li>Rival con carga de partidos en los últimos 7 días.</li><li>La cuota inicial bajó en varias casas.</li></ul></section><section><h3>Qué contradice la hipótesis</h3><ul className="evidence-list negative"><li>El rival mantiene un ranking considerablemente superior.</li><li>No hay confirmación independiente de molestias físicas.</li><li>H2H limitado; no permite una conclusión sólida.</li></ul></section></div>
        <section className="odds-section"><div className="section-heading"><div><h3>Cuotas y trazabilidad</h3><p>Datos de muestra. Conecta fuentes verificadas antes de decidir.</p></div><span className="data-badge"><ShieldCheck size={14} /> Requiere verificación</span></div><div className="odds-table"><div><span>Casa</span><span>Apertura</span><span>Actual</span></div><div><b>Casa A</b><span>1.98</span><strong>1.85</strong></div><div><b>Casa B</b><span>1.94</span><strong>1.87</strong></div><div><b>Casa C</b><span>2.01</span><strong>1.91</strong></div></div></section>
        <section className="anomaly"><AlertTriangle size={19} /><div><b>ANOMALÍA — REQUIERE INVESTIGACIÓN</b><p>Diferencia de 0.06 entre la mejor y la peor cuota disponible. Por sí sola no indica un resultado ni una irregularidad.</p></div></section><section className="conclusion"><ClipboardCheck size={21} /><div><span>DECISIÓN ACTUAL</span><b>NO BET — NO JUGAR ESTE PARTIDO</b><p>No hay información verificada suficiente para recomendar un mercado ni un participante. Guardarlo solo permite revisarlo más tarde.</p></div></section>
      </section>
      <aside className="control-panel"><div className="control-title"><ShieldCheck size={20} /><div><h2>Control personal</h2><p>Reglas activas para hoy</p></div></div><div className="selection-count"><span>CANDIDATOS</span><b>{selected.length}<small> / 5 máximo</small></b><div className="progress"><i style={{ width: `${(selected.length / 5) * 100}%` }} /></div></div><ul className="rule-list"><li><Check size={16} /> Sin apuestas en vivo</li><li><Check size={16} /> Sin combinadas</li><li><Check size={16} /> Stake no aumenta tras pérdida</li><li><Check size={16} /> Máximo cinco candidatos</li><li className={analysisClosed ? 'locked-rule' : ''}>{analysisClosed ? <LockKeyhole size={16} /> : <Check size={16} />} {analysisClosed ? 'Lista bloqueada' : 'Lista aún editable'}</li></ul><div className="no-bet-box"><b>NO BET es un resultado válido</b><p>Si ningún partido reúne evidencia suficiente, no se habilita ningún candidato.</p></div><button className="review-button" onClick={() => setShowReview(true)} disabled={selected.length === 0}>Revisar mis {selected.length} candidatos</button></aside>
    </section><footer>Atlas Research es una herramienta de análisis y control personal. No garantiza resultados ni sustituye una decisión responsable.</footer>
  </main>
}
export default App