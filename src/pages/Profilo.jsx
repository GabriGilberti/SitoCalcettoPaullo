import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

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

export default function Profilo() {
  const [players, setPlayers] = useState([])
  const [selected, setSelected] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentMatches, setRecentMatches] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from("players").select("*").order("name").then(({ data }) => {
      if (data) setPlayers(data)
    })
  }, [])

  async function loadProfile(player) {
    setSelected(player)
    setLoading(true)

    // Partite del giocatore
    const { data: mp } = await supabase
      .from("match_players")
      .select("match_id, team")
      .eq("player_id", player.id)

    if (!mp || mp.length === 0) {
      setStats({ played: 0, w: 0, l: 0, pts: 0, goals: 0 })
      setRecentMatches([])
      setLoading(false)
      return
    }

    const matchIds = mp.map(x => x.match_id)

    // Dati partite
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .in("id", matchIds)
      .order("created_at", { ascending: false })

    // Gol del giocatore
    const { data: goals } = await supabase
      .from("goals")
      .select("match_id, count")
      .eq("player_id", player.id)

    const goalMap = {}
    goals?.forEach(g => { goalMap[g.match_id] = g.count })

    const teamMap = {}
    mp.forEach(x => { teamMap[x.match_id] = x.team })

    let w = 0, l = 0, totalGoals = 0

    const recent = matches?.map(match => {
      const team = teamMap[match.id]
      const myScore = team === "A" ? match.score_a : match.score_b
      const theirScore = team === "A" ? match.score_b : match.score_a
      const result = myScore > theirScore ? "V" : myScore < theirScore ? "S" : "P"
      const gol = goalMap[match.id] || 0

      if (result === "V") w++
      if (result === "S") l++
      totalGoals += gol

      return {
        id: match.id,
        date: new Date(match.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
        result,
        goals: gol,
        teamName: team === "A" ? match.team_a_name : match.team_b_name,
        vs: team === "A" ? match.team_b_name : match.team_a_name,
        scoreFor: myScore,
        scoreAgainst: theirScore,
      }
    }) || []

    // Calcola pagella media storica
    const { data: allRatings } = await supabase
      .from("ratings")
      .select("candidate_id, position, match_id")
      .in("match_id", matchIds)  // ← tutti i giocatori, non solo player.id

    const { data: allMp } = await supabase
      .from("match_players")
      .select("player_id, team, match_id")
      .in("match_id", matchIds)

    const BASE_VOTES = [9.0, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0]

    let votoTot = 0, votoN = 0

    const ratingsByMatch = {}
    allRatings?.forEach(r => {
      if (!ratingsByMatch[r.match_id]) ratingsByMatch[r.match_id] = []
      ratingsByMatch[r.match_id].push(r)
    })

    Object.entries(ratingsByMatch).forEach(([matchId, ratings]) => {
      const mpMatch = allMp?.filter(x => x.match_id === matchId) || []

      const posSum = {}, posCount = {}
      ratings.forEach(r => {
        posSum[r.candidate_id] = (posSum[r.candidate_id] || 0) + r.position
        posCount[r.candidate_id] = (posCount[r.candidate_id] || 0) + 1
      })

      const playersInMatch = mpMatch.map(x => ({ id: x.player_id, team: x.team }))
      const withAvg = playersInMatch
        .filter(p => posSum[p.id])
        .map(p => ({ id: p.id, avgPos: posSum[p.id] / posCount[p.id] }))
        .sort((a, b) => a.avgPos - b.avgPos)

      const idx = withAvg.findIndex(p => p.id === player.id)
      if (idx !== -1) {
        votoTot += BASE_VOTES[idx] ?? 3.0
        votoN++
      }
    })

    setStats({
      played: mp.length, w, l,
      pts: w * 3 + (mp.length - w - l),
      goals: totalGoals,
      avg: mp.length > 0 ? (totalGoals / mp.length).toFixed(1) : "0.0",
      votoMedio: votoN > 0 ? Math.round((votoTot / votoN) * 10) / 10 : null,
    })
    setRecentMatches(recent)
    setLoading(false)
  }

  // Selezione giocatore
  if (!selected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>SELEZIONA GIOCATORE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {players.map(p => (
          <button key={p.id} onClick={() => loadProfile(p)} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", textAlign: "left",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: C.accent + "20", border: `2px solid ${C.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.accent, fontWeight: 900, fontSize: 16, flexShrink: 0,
            }}>{p.name[0]}</div>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{p.name}</span>
            <span style={{ color: C.muted, marginLeft: "auto" }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Back */}
      <button onClick={() => setSelected(null)} style={{
        background: "transparent", border: "none", color: C.muted,
        fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0,
      }}>← Tutti i giocatori</button>

      {loading ? (
        <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>Caricamento...</div>
      ) : (
        <>
          {/* Header profilo */}
          <Card glow style={{ textAlign: "center", padding: 28 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: C.accent + "20", border: `3px solid ${C.accent}60`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.accent, fontWeight: 900, fontSize: 30,
              margin: "0 auto 12px",
            }}>{selected.name[0]}</div>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>{selected.name}</div>
          </Card>

          {/* Stats griglia */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Gol totali", val: stats.goals, icon: "⚽" },
                { label: "Partite", val: stats.played, icon: "📅" },
                { label: "Vittorie", val: stats.w, icon: "✅" },
                { label: "Pagella media", val: stats.votoMedio ?? "—", icon: "⭐" },
              ].map(s => (
                <Card key={s.label} style={{ textAlign: "center", padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ color: C.accent, fontSize: 22, fontWeight: 900 }}>{s.val}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{s.label}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Ultime partite */}
          {recentMatches.length > 0 && (
            <Card>
              <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 14 }}>
                ULTIME PARTITE
              </div>
              {recentMatches.slice(0, 5).map((m, i) => (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 0",
                  borderBottom: i < Math.min(recentMatches.length, 5) - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <span style={{ color: C.muted, fontSize: 12, width: 44, flexShrink: 0 }}>{m.date}</span>
                  <span style={{
                    width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    background: m.result === "V" ? C.accent + "20" : m.result === "S" ? C.red + "20" : C.muted + "20",
                    color: m.result === "V" ? C.accent : m.result === "S" ? C.red : C.muted,
                  }}>{m.result}</span>
                  <span style={{ color: C.muted, fontSize: 12, flex: 1 }}>
                    {m.teamName} <span style={{ color: C.muted, fontSize: 11 }}>vs</span> {m.vs}
                  </span>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {m.scoreFor}–{m.scoreAgainst}
                  </span>
                  {m.goals > 0 && (
                    <span style={{ color: C.accent, fontSize: 12, flexShrink: 0 }}>⚽ {m.goals}</span>
                  )}
                </div>
              ))}
            </Card>
          )}

          {recentMatches.length === 0 && (
            <Card style={{ textAlign: "center", padding: 32 }}>
              <div style={{ color: C.muted, fontSize: 14 }}>Nessuna partita ancora per questo giocatore</div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}