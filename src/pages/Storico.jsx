import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

const C = {
  card: "#1a1a24", border: "#2a2a3a", accent: "#00e676",
  red: "#ff4444", text: "#f0f0f0", muted: "#6b6b8a",
  surface: "#13131a", gold: "#ffd700",
}

const Badge = ({ children, color = C.accent }) => (
  <span style={{
    background: color + "20", color, border: `1px solid ${color}40`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1,
  }}>{children}</span>
)

function buildRanking(players, ratingsData) {
  const BASE_VOTES = [9.0, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0]

  const posSum = {}, posCount = {}
  ratingsData.forEach(r => {
    posSum[r.candidate_id] = (posSum[r.candidate_id] || 0) + r.position
    posCount[r.candidate_id] = (posCount[r.candidate_id] || 0) + 1
  })

  const rated = players
    .filter(p => posSum[p.id])
    .map(p => ({
      ...p,
      avgPos: posSum[p.id] / posCount[p.id],
    }))
    .sort((a, b) => a.avgPos - b.avgPos) // chi ha posizione media più bassa è più bravo

  return rated.map((p, i) => ({
    ...p,
    voto: BASE_VOTES[i] ?? 3.0,
    globalPosition: i + 1,
  }))
}

export default function Storico() {
  const [matches, setMatches] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    setLoading(true)
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })

    if (data) setMatches(data)
    setLoading(false)
  }

  async function loadDetail(matchId) {
  if (details[matchId]) { setExpanded(expanded === matchId ? null : matchId); return }

  const { data: mp } = await supabase
    .from("match_players")
    .select("team, players(id, name)")
    .eq("match_id", matchId)

  const { data: goals } = await supabase
    .from("goals")
    .select("count, players(name)")
    .eq("match_id", matchId)
    .gt("count", 0)
    .order("count", { ascending: false })

  const { data: ratings } = await supabase
    .from("ratings")
    .select("candidate_id, position")
    .eq("match_id", matchId)

  // Calcola voto per ogni giocatore in questa partita
  const allPlayers = mp?.map(x => ({
    id: x.players.id, name: x.players.name, team: x.team,
  })) || []

  const hasVotes = (ratings?.length || 0) > 0
  const ranked = hasVotes ? buildRanking(allPlayers, ratings) : []
  const votoMap = {}
  ranked.forEach(p => { votoMap[p.id] = p.voto })

  const playersA = allPlayers.filter(p => p.team === "A")
    .map(p => ({ ...p, voto: votoMap[p.id] || null }))
    .sort((a, b) => (a.voto || 0) > (b.voto || 0) ? -1 : 1)

  const playersB = allPlayers.filter(p => p.team === "B")
    .map(p => ({ ...p, voto: votoMap[p.id] || null }))
    .sort((a, b) => (a.voto || 0) > (b.voto || 0) ? -1 : 1)

  setDetails(d => ({ ...d, [matchId]: { playersA, playersB, goals: goals || [], hasVotes } }))
  setExpanded(matchId)
  }

  if (loading) return <div style={{ color: "#6b6b8a", textAlign: "center", padding: 60 }}>Caricamento...</div>

  if (matches.length === 0) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Nessuna partita ancora</div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>
        STORICO · {matches.length} PARTITE
      </div>

      {matches.map(match => {
        const isExpanded = expanded === match.id
        const result = match.score_a > match.score_b ? "A" : match.score_a < match.score_b ? "B" : "X"
        const resultLabel = result === "A" ? `Vince ${match.team_a_name}` : result === "B" ? `Vince ${match.team_b_name}` : "Pareggio"
        const resultColor = result !== "X" ? C.accent : C.muted
        const date = new Date(match.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })
        const detail = details[match.id]

        return (
          <div key={match.id} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, overflow: "hidden", cursor: "pointer",
          }} onClick={() => loadDetail(match.id)}>

            {/* Riga principale */}
            <div style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: C.muted, fontSize: 12 }}>{date}</span>
                <Badge color={resultColor}>{resultLabel}</Badge>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: C.text, fontSize: 13, flex: 1 }}>{match.team_a_name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
                  <span style={{
                    fontSize: 26, fontWeight: 900,
                    color: match.score_a > match.score_b ? C.accent : C.text
                  }}>{match.score_a}</span>
                  <span style={{ color: C.muted, fontSize: 16 }}>—</span>
                  <span style={{
                    fontSize: 26, fontWeight: 900,
                    color: match.score_b > match.score_a ? C.accent : C.text
                  }}>{match.score_b}</span>
                </div>
                <span style={{ color: C.text, fontSize: 13, flex: 1, textAlign: "right" }}>{match.team_b_name}</span>
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>{isExpanded ? "▲ chiudi" : "▼ dettagli"}</span>
              </div>
            </div>

            {/* Dettaglio espanso */}
            {isExpanded && detail && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 18px", background: C.surface }}>
                {/* Giocatori */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[
                    { name: match.team_a_name, players: detail.playersA, color: C.accent },
                    { name: match.team_b_name, players: detail.playersB, color: C.red },
                  ].map(({ name, players, color }) => (
                    <div key={name}>
                      <div style={{ color, fontSize: 10, letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
                        {name.toUpperCase()}
                      </div>
                      {players.map(p => {
                        const votoColor = p.voto >= 8 ? C.gold : p.voto >= 6.5 ? C.accent : p.voto >= 5 ? C.text : C.muted
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                            <span style={{ color: C.text, fontSize: 12, flex: 1 }}>· {p.name}</span>
                            {detail.hasVotes && p.voto && (
                              <span style={{
                                background: votoColor + "20", color: votoColor,
                                borderRadius: 4, padding: "1px 6px",
                                fontWeight: 900, fontSize: 11,
                              }}>{p.voto}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {/* Marcatori */}
                {detail.goals.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>MARCATORI</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {detail.goals.map(g => (
                        <span key={g.players.name} style={{
                          background: C.card, border: `1px solid ${C.border}`,
                          borderRadius: 6, padding: "4px 10px", fontSize: 12, color: C.text
                        }}>
                          ⚽ {g.count > 1 ? `×${g.count} ` : ""}{g.players.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}