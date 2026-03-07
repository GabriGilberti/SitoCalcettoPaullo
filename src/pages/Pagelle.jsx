import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"
import { useAuth } from "../AuthContext"
import { useState, useEffect, useRef } from "react"

const C = {
  card: "#1a1a24", border: "#2a2a3a", accent: "#00e676",
  red: "#ff4444", text: "#f0f0f0", muted: "#6b6b8a",
  surface: "#13131a", gold: "#ffd700",
}

const Card = ({ children, style = {}, glow = false }) => (
  <div style={{
    background: C.card, borderRadius: 12, padding: 18,
    border: `1px solid ${glow ? C.accent + "60" : C.border}`,
    boxShadow: glow ? `0 0 24px ${C.accent}15` : "none",
    ...style
  }}>{children}</div>
)

const Badge = ({ children, color = C.accent }) => (
  <span style={{
    background: color + "20", color, border: `1px solid ${color}40`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1,
  }}>{children}</span>
)

const BASE_VOTES = [9.0, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0]

function buildRanking(players, ratingsData) {
  const posSum = {}, posCount = {}
  ratingsData.forEach(r => {
    posSum[r.candidate_id] = (posSum[r.candidate_id] || 0) + r.position
    posCount[r.candidate_id] = (posCount[r.candidate_id] || 0) + 1
  })
  return players
    .filter(p => posSum[p.id])
    .map(p => ({ ...p, avgPos: posSum[p.id] / posCount[p.id] }))
    .sort((a, b) => a.avgPos - b.avgPos)
    .map((p, i) => ({ ...p, voto: BASE_VOTES[i] ?? 3.0 }))
}

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    if (!targetDate) return
    const update = () => {
      const diff = new Date(targetDate) - new Date()
      if (diff <= 0) { setTimeLeft("Scaduto"); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}h ${m}m`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function DraggableList({ players, color, onReorder }) {
  const [items, setItems] = useState(players)
  const dragIndex = useRef(null)
  const dragOverIdx = useRef(null)
  const touchStartY = useRef(null)
  const touchItem = useRef(null)

  useEffect(() => { setItems(players) }, [players])

  // Desktop drag
  const handleDragStart = (i) => { dragIndex.current = i }
  const handleDragEnter = (i) => { dragOverIdx.current = i }
  const handleDragEnd = () => {
    if (dragIndex.current === null || dragOverIdx.current === null || dragIndex.current === dragOverIdx.current) return
    const updated = [...items]
    const [moved] = updated.splice(dragIndex.current, 1)
    updated.splice(dragOverIdx.current, 0, moved)
    setItems(updated)
    onReorder(updated)
    dragIndex.current = null
    dragOverIdx.current = null
  }

  // Touch drag
  const handleTouchStart = (e, i) => {
    touchItem.current = i
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    const y = e.touches[0].clientY
    const elements = document.elementsFromPoint(e.touches[0].clientX, y)
    const target = elements.find(el => el.dataset.idx !== undefined)
    if (target) dragOverIdx.current = parseInt(target.dataset.idx)
  }

  const handleTouchEnd = () => {
    if (touchItem.current === null || dragOverIdx.current === null || touchItem.current === dragOverIdx.current) {
      touchItem.current = null; dragOverIdx.current = null; return
    }
    const updated = [...items]
    const [moved] = updated.splice(touchItem.current, 1)
    updated.splice(dragOverIdx.current, 0, moved)
    setItems(updated)
    onReorder(updated)
    touchItem.current = null
    dragOverIdx.current = null
  }

  return (
    <div>
      {items.map((player, i) => (
        <div
          key={player.id}
          data-idx={i}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragEnter={() => handleDragEnter(i)}
          onDragEnd={handleDragEnd}
          onDragOver={e => e.preventDefault()}
          onTouchStart={e => handleTouchStart(e, i)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", marginBottom: 8,
            background: C.surface, borderRadius: 10,
            border: `1px solid ${C.border}`,
            cursor: "grab", userSelect: "none",
            touchAction: "none",  // ← disabilita scroll durante drag
          }}
        >
          <span style={{ color, fontWeight: 900, fontSize: 16, width: 24, textAlign: "center" }}>{i + 1}</span>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: color + "20", border: `1px solid ${color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color, fontSize: 15, fontWeight: 900,
          }}>{player.name[0]}</div>
          <span style={{ color: C.text, fontWeight: 600, fontSize: 15, flex: 1 }}>{player.name}</span>
          <span style={{ color: C.muted, fontSize: 18 }}>⠿</span>
        </div>
      ))}
    </div>
  )
}

export default function Pagelle() {
  const { user } = useAuth()
  const [lastMatch, setLastMatch] = useState(null)
  const [playersA, setPlayersA] = useState([])
  const [playersB, setPlayersB] = useState([])
  const [phase, setPhase] = useState("intro")
  const [rankingA, setRankingA] = useState([])
  const [rankingB, setRankingB] = useState([])
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasVoted, setHasVoted] = useState(false)
  const [voterCount, setVoterCount] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [voteDeadline, setVoteDeadline] = useState(null)

  const countdown = useCountdown(voteDeadline)

  useEffect(() => { loadLastMatch() }, [])

  async function loadLastMatch() {
    setLoading(true)
    const { data: match } = await supabase
      .from("matches").select("*")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle()

    if (!match) { setLoading(false); return }
    setLastMatch(match)

    // Deadline = 24h dopo la creazione della partita
    const deadline = new Date(match.created_at)
    deadline.setHours(deadline.getHours() + 24)
    setVoteDeadline(deadline)

    const { data: mp } = await supabase
      .from("match_players")
      .select("team, players(id, name)")
      .eq("match_id", match.id)

    if (mp) {
      const pA = mp.filter(x => x.team === "A").map(x => x.players)
      const pB = mp.filter(x => x.team === "B").map(x => x.players)
      setPlayersA(pA)
      setPlayersB(pB)
      setRankingA(pA)
      setRankingB(pB)
      setTotalPlayers(pA.length + pB.length)
    }

    // Controlla se l'utente ha già votato
    if (user) {
      const { data: myVote } = await supabase
        .from("ratings")
        .select("id")
        .eq("match_id", match.id)
        .eq("voter_id", user.id)
        .limit(1)
        .maybeSingle()
      setHasVoted(!!myVote)
    }

    await loadResults(match.id)
    await loadVoterCount(match.id)
    setLoading(false)
  }

  async function loadVoterCount(matchId) {
    const { data } = await supabase
      .from("ratings")
      .select("voter_id")
      .eq("match_id", matchId)
      .not("voter_id", "is", null)

    if (data) {
      const unique = new Set(data.map(r => r.voter_id))
      setVoterCount(unique.size)
    }
  }

  async function loadResults(matchId) {
    const { data } = await supabase
      .from("ratings").select("candidate_id, position")
      .eq("match_id", matchId)
    if (!data || data.length === 0) return

    const ids = [...new Set(data.map(r => r.candidate_id))]
    const { data: playersData } = await supabase
      .from("players").select("id, name").in("id", ids)
    if (!playersData) return

    const { data: mp } = await supabase
      .from("match_players").select("player_id, team").eq("match_id", matchId)
    const teamMap = {}
    mp?.forEach(p => { teamMap[p.player_id] = p.team })

    const players = playersData.map(p => ({ ...p, team: teamMap[p.id] || "A" }))
    setResults(buildRanking(players, data))
  }

  async function handleSave() {
    setSaving(true)
    const rows = [
      ...rankingA.map((p, i) => ({
        match_id: lastMatch.id,
        candidate_id: p.id,
        voter_id: user.id,
        position: i + 1,
        wins: 0,
      })),
      ...rankingB.map((p, i) => ({
        match_id: lastMatch.id,
        candidate_id: p.id,
        voter_id: user.id,
        position: i + 1,
        wins: 0,
      })),
    ]

    const { error } = await supabase.from("ratings").insert(rows)
    if (error) {
      if (error.code === "23505") {
        alert("Hai già votato per questa partita!")
      } else {
        alert("Errore: " + error.message)
      }
      setSaving(false)
      return
    }

    setHasVoted(true)
    await loadResults(lastMatch.id)
    await loadVoterCount(lastMatch.id)
    setSaving(false)
    setPhase("results")
  }

  if (loading) return <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>Caricamento...</div>

  if (!lastMatch) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🗳️</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Nessuna partita ancora</div>
    </div>
  )

  const date = new Date(lastMatch.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long" })
  const isExpired = voteDeadline && new Date() > new Date(voteDeadline)

  // Card partecipazione
  const PartecipazoneCard = () => (
    <Card style={{
      background: `linear-gradient(135deg, ${C.accent}10, ${C.accent}05)`,
      border: `1px solid ${C.accent}30`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>PARTECIPAZIONE</div>
        {isExpired
          ? <Badge color={C.red}>Scaduto</Badge>
          : <Badge color={C.accent}>⏱ {countdown}</Badge>
        }
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4,
            width: `${totalPlayers > 0 ? (voterCount / totalPlayers) * 100 : 0}%`,
            background: C.accent, transition: "width 0.5s",
          }} />
        </div>
        <span style={{ color: C.accent, fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
          {voterCount}/{totalPlayers}
        </span>
      </div>
      <div style={{ color: C.muted, fontSize: 12 }}>
        {voterCount === 0
          ? "Nessuno ha ancora votato"
          : voterCount === totalPlayers
          ? "✅ Tutti hanno votato!"
          : `${totalPlayers - voterCount} ${totalPlayers - voterCount === 1 ? "giocatore deve" : "giocatori devono"} ancora votare`
        }
      </div>
    </Card>
  )

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card glow style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗳️</div>
        <div style={{ color: C.text, fontSize: 20, fontWeight: 900, marginBottom: 6 }}>
          Pagelle · {date}
        </div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>
          {lastMatch.team_a_name} {lastMatch.score_a} — {lastMatch.score_b} {lastMatch.team_b_name}
        </div>
        <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.9, marginBottom: 24 }}>
          Ordina i giocatori di ogni squadra<br />
          dal migliore al peggiore.<br />
          <span style={{ color: C.accent, fontWeight: 700 }}>Trascina per riordinare.</span>
        </div>

        {hasVoted ? (
          <div style={{
            background: C.accent + "15", border: `1px solid ${C.accent}40`,
            borderRadius: 10, padding: "12px 20px", marginBottom: 16,
            color: C.accent, fontWeight: 700, fontSize: 14,
          }}>✅ Hai già votato per questa partita</div>
        ) : isExpired ? (
          <div style={{
            background: C.red + "15", border: `1px solid ${C.red}40`,
            borderRadius: 10, padding: "12px 20px", marginBottom: 16,
            color: C.red, fontWeight: 700, fontSize: 14,
          }}>⏱ Votazione scaduta</div>
        ) : (
          <button onClick={() => setPhase("rankA")} style={{
            background: C.accent, color: C.card, border: "none",
            borderRadius: 10, padding: "14px 40px", fontWeight: 900,
            fontSize: 15, cursor: "pointer",
          }}>VOTA ORA →</button>
        )}
      </Card>

      <PartecipazoneCard />

      {results.length > 0 && (
        <Card>
          <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
            PAGELLE ATTUALI
          </div>
          {results.slice(0, 6).map((r, i) => {
            const votoColor = r.voto >= 8 ? C.gold : r.voto >= 6.5 ? C.accent : r.voto >= 5 ? C.text : C.muted
            return (
              <div key={r.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: i < 5 ? `1px solid ${C.border}` : "none"
              }}>
                <span style={{ color: C.muted, width: 20 }}>{i + 1}</span>
                <span style={{ color: C.text, flex: 1, fontWeight: 600 }}>{r.name}</span>
                <span style={{
                  background: votoColor + "20", color: votoColor,
                  borderRadius: 6, padding: "2px 10px", fontWeight: 900,
                }}>{r.voto}</span>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )

  // ── RANKING SQUADRA A ──────────────────────────────────────────────────────
  if (phase === "rankA") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Badge color={C.accent}>1 / 2 · {lastMatch.team_a_name}</Badge>
          <span style={{ color: C.muted, fontSize: 12 }}>Squadra A</span>
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 10 }}>
          <div style={{ width: "50%", height: "100%", background: C.accent, borderRadius: 2 }} />
        </div>
      </Card>
      <Card>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 16 }}>
          ORDINA DAL MIGLIORE AL PEGGIORE
        </div>
        <DraggableList players={rankingA} color={C.accent} onReorder={setRankingA} />
      </Card>
      <button onClick={() => setPhase("rankB")} style={{
        background: C.accent, color: C.card, border: "none",
        borderRadius: 10, padding: "14px", fontWeight: 900, fontSize: 15, cursor: "pointer",
      }}>AVANTI → {lastMatch.team_b_name}</button>
      <button onClick={() => setPhase("intro")} style={{
        background: "transparent", color: C.muted,
        border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "10px", fontSize: 12, cursor: "pointer",
      }}>✕ Annulla votazione</button>
    </div>
  )

  // ── RANKING SQUADRA B ──────────────────────────────────────────────────────
  if (phase === "rankB") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Badge color={C.red}>2 / 2 · {lastMatch.team_b_name}</Badge>
          <span style={{ color: C.muted, fontSize: 12 }}>Squadra B</span>
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 10 }}>
          <div style={{ width: "100%", height: "100%", background: C.red, borderRadius: 2 }} />
        </div>
      </Card>
      <Card>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 16 }}>
          ORDINA DAL MIGLIORE AL PEGGIORE
        </div>
        <DraggableList players={rankingB} color={C.red} onReorder={setRankingB} />
      </Card>
      <button onClick={handleSave} disabled={saving} style={{
        background: C.accent, color: C.card, border: "none",
        borderRadius: 10, padding: "14px", fontWeight: 900,
        fontSize: 15, cursor: "pointer", opacity: saving ? 0.6 : 1,
      }}>{saving ? "SALVATAGGIO..." : "SALVA PAGELLE ✓"}</button>
      <button onClick={() => setPhase("rankA")} style={{
        background: "transparent", color: C.muted,
        border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "8px", fontSize: 12, cursor: "pointer",
      }}>← Torna a {lastMatch.team_a_name}</button>
      <button onClick={() => { setPhase("intro"); setRankingA(playersA); setRankingB(playersB) }} style={{
        background: "transparent", color: C.red + "90",
        border: `1px solid ${C.red}30`, borderRadius: 8,
        padding: "10px", fontSize: 12, cursor: "pointer",
      }}>✕ Annulla votazione</button>
    </div>
  )

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const mvp = results[0]
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card glow style={{ textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
          <div style={{ color: C.gold, fontSize: 26, fontWeight: 900 }}>{mvp?.name}</div>
          <div style={{ color: C.text, fontSize: 14, marginTop: 4 }}>MVP della partita · {date}</div>
        </Card>

        <PartecipazoneCard />

        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>PAGELLE COMPLETE</div>
        {results.map((r, i) => {
          const votoColor = r.voto >= 8 ? C.gold : r.voto >= 6.5 ? C.accent : r.voto >= 5.5 ? C.text : C.muted
          return (
            <div key={r.name} style={{
              background: C.card, border: `1px solid ${i === 0 ? C.gold + "50" : C.border}`,
              borderRadius: 12, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: i === 0 ? `0 0 20px ${C.gold}10` : "none",
            }}>
              <span style={{ color: C.muted, width: 24, fontSize: 14 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                  posizione media {r.avgPos.toFixed(1)}
                </div>
              </div>
              <div style={{
                background: votoColor + "20", border: `1px solid ${votoColor}40`,
                borderRadius: 8, padding: "6px 14px", textAlign: "center",
              }}>
                <div style={{ color: votoColor, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{r.voto}</div>
                <div style={{ color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 2 }}>VOTO</div>
              </div>
            </div>
          )
        })}

        <button onClick={() => setPhase("intro")} style={{
          background: "transparent", color: C.muted,
          border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "10px", fontSize: 12, cursor: "pointer",
        }}>← Torna alla intro</button>
      </div>
    )
  }

  return null
}