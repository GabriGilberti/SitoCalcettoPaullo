import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

const C = {
  card: "#1a1a24", border: "#2a2a3a", accent: "#00e676",
  red: "#ff4444", text: "#f0f0f0", muted: "#6b6b8a",
  surface: "#13131a", gold: "#ffd700",
}

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

export default function Classifica() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStandings() }, [])

  async function loadStandings() {
    setLoading(true)

    const { data: matches } = await supabase
      .from("matches").select("id, score_a, score_b")

    const { data: matchPlayers } = await supabase
      .from("match_players")
      .select("match_id, player_id, team, players(name)")

    const { data: allRatings } = await supabase
      .from("ratings").select("candidate_id, position, match_id")

    if (!matches || !matchPlayers) { setLoading(false); return }

    // Calcola voto medio per giocatore su tutte le partite
    // Per ogni partita, ricostruisci la classifica e assegna il voto
    const votoSum = {}
    const votoCount = {}

    // Raggruppa ratings per partita
    const ratingsByMatch = {}
    allRatings?.forEach(r => {
      if (!ratingsByMatch[r.match_id]) ratingsByMatch[r.match_id] = []
      ratingsByMatch[r.match_id].push(r)
    })

    Object.entries(ratingsByMatch).forEach(([matchId, ratings]) => {
      const mpMatch = matchPlayers.filter(mp => mp.match_id === matchId)
      const players = mpMatch.map(mp => ({ id: mp.player_id, team: mp.team }))
      const ranked = buildRanking(players, ratings)
      ranked.forEach(p => {
        votoSum[p.id] = (votoSum[p.id] || 0) + p.voto
        votoCount[p.id] = (votoCount[p.id] || 0) + 1
      })
    })

    // Calcola stats partite
    const stats = {}
    matchPlayers.forEach(mp => {
      const name = mp.players.name
      const id = mp.player_id
      if (!stats[id]) stats[id] = { name, played: 0, w: 0, d: 0, l: 0, pts: 0 }
    })

    matches.forEach(match => {
      const playersInMatch = matchPlayers.filter(mp => mp.match_id === match.id)
      playersInMatch.forEach(mp => {
        const id = mp.player_id
        const isA = mp.team === "A"
        const myScore = isA ? match.score_a : match.score_b
        const theirScore = isA ? match.score_b : match.score_a
        stats[id].played += 1
        if (myScore > theirScore) { stats[id].w += 1; stats[id].pts += 3 }
        else if (myScore < theirScore) { stats[id].l += 1 }
        else { stats[id].d += 1; stats[id].pts += 1 }
      })
    })

    const sorted = Object.entries(stats).map(([id, s]) => ({
      ...s,
      votoMedio: votoCount[id] ? Math.round((votoSum[id] / votoCount[id]) * 10) / 10 : null,
      votiPartite: votoCount[id] || 0,
    })).sort((a, b) => b.pts - a.pts || b.w - a.w)

    setStandings(sorted)
    setLoading(false)
  }

  if (loading) return <div style={{ color: "#6b6b8a", textAlign: "center", padding: 60 }}>Caricamento...</div>

  if (standings.length === 0) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Nessuna partita ancora</div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>STAGIONE 2025/26</div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "28px 1fr 32px 32px 32px 32px 40px 44px",
          background: C.surface, padding: "10px 14px",
          color: C.muted, fontSize: 10, letterSpacing: 1, fontWeight: 700,
        }}>
          <span>#</span>
          <span>Giocatore</span>
          <span style={{ textAlign: "center" }}>PG</span>
          <span style={{ textAlign: "center" }}>V</span>
          <span style={{ textAlign: "center" }}>P</span>
          <span style={{ textAlign: "center" }}>S</span>
          <span style={{ textAlign: "center" }}>Pt</span>
          <span style={{ textAlign: "center" }}>⭐</span>
        </div>

        {standings.map((p, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
          const votoColor = p.votoMedio >= 8 ? C.gold : p.votoMedio >= 6.5 ? C.accent : p.votoMedio >= 5 ? C.text : C.muted
          return (
            <div key={p.name} style={{
              display: "grid", gridTemplateColumns: "28px 1fr 32px 32px 32px 32px 40px 44px",
              padding: "11px 14px", alignItems: "center",
              borderTop: `1px solid ${C.border}`,
              background: i === 0 ? C.accent + "08" : "transparent",
            }}>
              <span style={{ color: medal ? C.gold : C.muted, fontSize: 13, fontWeight: 700 }}>
                {medal || i + 1}
              </span>
              <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
              <span style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>{p.played}</span>
              <span style={{ color: C.accent, fontSize: 12, textAlign: "center", fontWeight: 700 }}>{p.w}</span>
              <span style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>{p.d}</span>
              <span style={{ color: C.red, fontSize: 12, textAlign: "center" }}>{p.l}</span>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <span style={{
                  background: i === 0 ? C.accent : C.accent + "20",
                  color: i === 0 ? "#0a0a0f" : C.accent,
                  borderRadius: 6, padding: "2px 8px",
                  fontWeight: 900, fontSize: 12,
                }}>{p.pts}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                {p.votoMedio ? (
                  <span style={{
                    background: votoColor + "20", color: votoColor,
                    borderRadius: 6, padding: "2px 8px",
                    fontWeight: 900, fontSize: 12,
                  }}>{p.votoMedio}</span>
                ) : (
                  <span style={{ color: C.muted, fontSize: 11 }}>—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}