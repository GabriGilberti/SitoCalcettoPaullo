import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

const C = {
  card: "#1a1a24", border: "#2a2a3a", accent: "#00e676",
  text: "#f0f0f0", muted: "#6b6b8a", surface: "#13131a", gold: "#ffd700",
}

export default function Marcatori() {
  const [scorers, setScorers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadScorers() }, [])

  async function loadScorers() {
    setLoading(true)

    const { data } = await supabase
      .from("goals")
      .select("count, players(name)")

    if (!data) { setLoading(false); return }

    // Aggrega per giocatore
    const totals = {}
    data.forEach(g => {
      const name = g.players.name
      totals[name] = (totals[name] || 0) + g.count
    })

    // Prendi le partite per calcolare la media
    const { data: mp } = await supabase
      .from("match_players")
      .select("player_id, players(name)")

    const played = {}
    if (mp) {
      mp.forEach(p => {
        const name = p.players.name
        played[name] = (played[name] || 0) + 1
      })
    }

    const sorted = Object.entries(totals)
      .map(([name, goals]) => ({
        name, goals,
        played: played[name] || 1,
        avg: (goals / (played[name] || 1)).toFixed(1)
      }))
      .sort((a, b) => b.goals - a.goals)

    setScorers(sorted)
    setLoading(false)
  }

  if (loading) return <div style={{ color: "#6b6b8a", textAlign: "center", padding: 60 }}>Caricamento...</div>

  if (scorers.length === 0) return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>👟</div>
      <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Nessun gol ancora</div>
    </div>
  )

  const max = scorers[0].goals

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>CLASSIFICA MARCATORI</div>

      {scorers.map((p, i) => (
        <div key={p.name} style={{
          background: C.card, border: `1px solid ${i === 0 ? C.gold + "40" : C.border}`,
          borderRadius: 12, padding: "14px 18px",
          boxShadow: i === 0 ? `0 0 20px ${C.gold}10` : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ color: C.muted, fontSize: 13, width: 20, textAlign: "center", fontWeight: 700 }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <span style={{ color: C.text, fontWeight: 700, flex: 1, fontSize: 15 }}>{p.name}</span>
            <span style={{ color: i === 0 ? C.gold : C.accent, fontWeight: 900, fontSize: 22 }}>{p.goals}</span>
            <span style={{ color: C.muted, fontSize: 12 }}>gol</span>
          </div>
          <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${(p.goals / max) * 100}%`,
              background: i === 0 ? C.gold : C.accent,
            }} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ color: C.muted, fontSize: 11 }}>
              Media: <span style={{ color: C.text }}>{p.avg}/partita</span>
            </span>
            <span style={{ color: C.muted, fontSize: 11 }}>
              In: <span style={{ color: C.text }}>{p.played} gare</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}