import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

const C = {
  bg: "#0a0a0f", surface: "#13131a", card: "#1a1a24",
  border: "#2a2a3a", accent: "#00e676", red: "#ff4444",
  gold: "#ffd700", text: "#f0f0f0", muted: "#6b6b8a",
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

export default function Home({ onNavigate }) {
  const [match, setMatch] = useState(null)
  const [scorers, setScorers] = useState([])
  const [playersA, setPlayersA] = useState([])
  const [playersB, setPlayersB] = useState([])
  const [loading, setLoading] = useState(true)
  const [mvpName, setMvpName] = useState(null)
  const [mvpGoals, setMvpGoals] = useState(0)
  const [seasonStats, setSeasonStats] = useState({ matches: 0, goals: 0, avg: "0.0" })

  useEffect(() => {
    loadLastMatch()
  }, [])

  async function loadLastMatch() {
    setLoading(true)

    // Ultima partita
    const { data: lastMatch } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lastMatch) { setLoading(false); return }
    setMatch(lastMatch)

    // Giocatori delle due squadre
    const { data: mp } = await supabase
      .from("match_players")
      .select("team, players(name)")
      .eq("match_id", lastMatch.id)

    if (mp) {
      setPlayersA(mp.filter(x => x.team === "A").map(x => x.players.name))
      setPlayersB(mp.filter(x => x.team === "B").map(x => x.players.name))
    }

    // Marcatori
    const { data: goals } = await supabase
      .from("goals")
      .select("count, players(name)")
      .eq("match_id", lastMatch.id)
      .gt("count", 0)
      .order("count", { ascending: false })

    if (goals) setScorers(goals)

    // MVP ultima partita (giocatore con voto più alto)
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("candidate_id, position")
      .eq("match_id", lastMatch.id)

    if (ratingsData && ratingsData.length > 0) {
      const posSum = {}, posCount = {}
      ratingsData.forEach(r => {
        posSum[r.candidate_id] = (posSum[r.candidate_id] || 0) + r.position
        posCount[r.candidate_id] = (posCount[r.candidate_id] || 0) + 1
      })
      const best = Object.entries(posSum)
        .map(([id, s]) => ({ id, avgPos: s / posCount[id] }))
        .sort((a, b) => a.avgPos - b.avgPos)[0]

      if (best) {
        const { data: mvpPlayer } = await supabase
          .from("players").select("name").eq("id", best.id).maybeSingle()
        if (mvpPlayer) setMvpName(mvpPlayer.name)

        const { data: mvpGoalData } = await supabase
          .from("goals")
          .select("count")
          .eq("match_id", lastMatch.id)
          .eq("player_id", best.id)
          .maybeSingle()
        setMvpGoals(mvpGoalData?.count || 0)
      }
    }

    // Stats stagione
    const { data: allMatches } = await supabase.from("matches").select("id, score_a, score_b")
    const { data: allGoals } = await supabase.from("goals").select("count")

    const totalMatches = allMatches?.length || 0
    const totalGoals = allGoals?.reduce((s, g) => s + g.count, 0) || 0
    setSeasonStats({
      matches: totalMatches,
      goals: totalGoals,
      avg: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : "0.0",
    })
    setLoading(false)
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: C.muted }}>Caricamento...</div>
  )

  if (!match) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚽</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nessuna partita ancora</div>
      <div style={{ color: C.muted, fontSize: 14 }}>Inserisci la prima partita per iniziare!</div>
    </div>
  )

  const resultLabel = match.score_a > match.score_b
    ? `Vittoria ${match.team_a_name}` : match.score_a < match.score_b
    ? `Vittoria ${match.team_b_name}` : "Pareggio"
  const resultColor = match.score_a !== match.score_b ? C.accent : C.muted

  const date = new Date(match.created_at).toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long"
  })

  const scorersA = scorers.filter(s =>
    playersA.includes(s.players.name)
  )
  const scorersB = scorers.filter(s =>
    playersB.includes(s.players.name)
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Ultima partita */}
      <Card glow style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, ${C.accent}10, transparent 70%)`,
          pointerEvents: "none"
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Badge>Ultima partita</Badge>
          <span style={{ color: C.muted, fontSize: 12 }}>{date}</span>
        </div>

        {/* Risultato */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ color: C.text, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
              {match.team_a_name.toUpperCase()}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              {playersA.join(" · ")}
            </div>
          </div>

          <div style={{ textAlign: "center", padding: "0 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 48, fontWeight: 900, lineHeight: 1 }}>
              <span style={{ color: match.score_a >= match.score_b ? C.accent : C.text }}>{match.score_a}</span>
              <span style={{ color: C.muted, fontSize: 24 }}>—</span>
              <span style={{ color: match.score_b >= match.score_a ? C.accent : C.text }}>{match.score_b}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <Badge color={resultColor}>{resultLabel}</Badge>
            </div>
          </div>

          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ color: C.text, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
              {match.team_b_name.toUpperCase()}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              {playersB.join(" · ")}
            </div>
          </div>
        </div>

        {/* Marcatori */}
        {scorers.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>MARCATORI {match.team_a_name.toUpperCase()}</div>
              {scorersA.length === 0
                ? <div style={{ color: C.muted, fontSize: 12 }}>—</div>
                : scorersA.map(s => (
                  <div key={s.players.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: C.accent, fontSize: 12 }}>⚽ ×{s.count}</span>
                    <span style={{ color: C.text, fontSize: 13 }}>{s.players.name}</span>
                  </div>
                ))
              }
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>MARCATORI {match.team_b_name.toUpperCase()}</div>
              {scorersB.length === 0
                ? <div style={{ color: C.muted, fontSize: 12 }}>—</div>
                : scorersB.map(s => (
                  <div key={s.players.name} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: C.text, fontSize: 13 }}>{s.players.name}</span>
                    <span style={{ color: C.red, fontSize: 12 }}>⚽ ×{s.count}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </Card>
      
      {/* MVP + stats stagione */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* MVP ultima partita */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>MVP ULTIMA PARTITA</div>
          <div style={{ fontSize: 32, marginBottom: 4 }}>👑</div>
          {mvpName ? (
            <>
              <div style={{ color: C.gold, fontSize: 18, fontWeight: 900 }}>{mvpName}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{mvpGoals > 0 ? `${mvpGoals} gol` : "nessun gol"}</div>
            </>
          ) : (
            <div style={{ color: C.muted, fontSize: 12, fontStyle: "italic" }}>Nessuna pagella</div>
          )}
        </div>

        {/* Stats stagione */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>QUESTA STAGIONE</div>
          {[
            { label: "Partite", val: seasonStats.matches },
            { label: "Gol totali", val: seasonStats.goals },
            { label: "Media gol", val: seasonStats.avg },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ color: C.muted, fontSize: 12 }}>{s.label}</span>
              <span style={{ color: C.accent, fontSize: 13, fontWeight: 700 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA pagelle */}
      <Card style={{
        background: `linear-gradient(135deg, ${C.accent}12, ${C.accent}05)`,
        border: `1px solid ${C.accent}30`, textAlign: "center"
      }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🗳️</div>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 4 }}>Vota le pagelle!</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>Hai 24 ore per votare</div>
        <button
          onClick={() => onNavigate("pagelle")}
          style={{
            background: C.accent, color: C.bg, border: "none",
            borderRadius: 8, padding: "10px 24px", fontWeight: 900,
            fontSize: 13, cursor: "pointer",
          }}>VOTA ORA →</button>
      </Card>

    </div>
  )
}