import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"
import { useAuth } from "../AuthContext"

const C = {
  bg: "#0a0a0f", surface: "#13131a", card: "#1a1a24",
  border: "#2a2a3a", accent: "#00e676", red: "#ff4444",
  text: "#f0f0f0", muted: "#6b6b8a",
}

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, ...style }}>
    {children}
  </div>
)

const Label = ({ children }) => (
  <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
    {children}
  </div>
)

export default function NuovaPartita() {
  const [players, setPlayers] = useState([])
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])
  const [nameA, setNameA] = useState("")
  const [nameB, setNameB] = useState("")
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [goalsA, setGoalsA] = useState({})
  const [goalsB, setGoalsB] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from("players").select("*").order("name").then(({ data }) => {
      if (data) setPlayers(data)
    })
  }, [])

  const { player } = useAuth()

  const togglePlayer = (player) => {
    if (teamA.find(p => p.id === player.id)) {
      setTeamA(teamA.filter(p => p.id !== player.id))
      setGoalsA(g => { const n = {...g}; delete n[player.id]; return n })
      return
    }
    if (teamB.find(p => p.id === player.id)) {
      setTeamB(teamB.filter(p => p.id !== player.id))
      setGoalsB(g => { const n = {...g}; delete n[player.id]; return n })
      return
    }
    if (teamA.length < 6) setTeamA([...teamA, player])
    else if (teamB.length < 6) setTeamB([...teamB, player])
  }

  const totalGoalsA = Object.values(goalsA).reduce((s, v) => s + v, 0)
  const totalGoalsB = Object.values(goalsB).reduce((s, v) => s + v, 0)
  const canSave = teamA.length === 6 && teamB.length === 6
    && totalGoalsA === scoreA && totalGoalsB === scoreB

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: match, error } = await supabase
        .from("matches")
        .insert({
          team_a_name: nameA || "Squadra A",
          team_b_name: nameB || "Squadra B",
          score_a: scoreA,
          score_b: scoreB,
          created_by: player?.id,
        })
        .select().maybeSingle()
      if (error) throw error

      await supabase.from("match_players").insert([
        ...teamA.map(p => ({ match_id: match.id, player_id: p.id, team: "A" })),
        ...teamB.map(p => ({ match_id: match.id, player_id: p.id, team: "B" })),
      ])

      const goalRows = [
        ...Object.entries(goalsA).filter(([, v]) => v > 0).map(([id, count]) => ({ match_id: match.id, player_id: id, count })),
        ...Object.entries(goalsB).filter(([, v]) => v > 0).map(([id, count]) => ({ match_id: match.id, player_id: id, count })),
      ]
      if (goalRows.length > 0) await supabase.from("goals").insert(goalRows)

      setSuccess(true)
      setTeamA([]); setTeamB([]); setNameA(""); setNameB("")
      setScoreA(0); setScoreB(0); setGoalsA({}); setGoalsB({})
    } catch (e) {
      alert("Errore: " + e.message)
    }
    setSaving(false)
  }

  if (success) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 56 }}>✅</div>
      <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>Partita salvata!</div>
      <button onClick={() => setSuccess(false)} style={{
        background: C.accent, color: C.bg, border: "none",
        borderRadius: 12, padding: "14px 32px", fontWeight: 900, fontSize: 15, cursor: "pointer", marginTop: 8
      }}>INSERISCI UN'ALTRA</button>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Giocatori */}
      <Card>
        <Label>GIOCATORI <span style={{ color: C.accent }}>— tocca per assegnare</span></Label>
        {players.length === 0 && (
          <div style={{ color: C.muted, fontSize: 13, fontStyle: "italic" }}>Nessun giocatore nel database</div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {players.map(p => {
            const inA = teamA.find(x => x.id === p.id)
            const inB = teamB.find(x => x.id === p.id)
            return (
              <button key={p.id} onClick={() => togglePlayer(p)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "2px solid",
                background: inA ? C.accent + "20" : inB ? C.red + "20" : C.surface,
                borderColor: inA ? C.accent : inB ? C.red : C.border,
                color: inA ? C.accent : inB ? C.red : C.muted,
              }}>{p.name}</button>
            )
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { team: teamA, name: nameA, setName: setNameA, color: C.accent, label: "A" },
            { team: teamB, name: nameB, setName: setNameB, color: C.red, label: "B" },
          ].map(({ team, name, setName, color, label }) => (
            <div key={label} style={{ background: C.surface, borderRadius: 10, padding: 12, border: `1px solid ${color}30` }}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={`Nome squadra ${label}`}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  borderBottom: `1px solid ${color}50`, width: "100%",
                  color, fontSize: 13, fontWeight: 700, paddingBottom: 4, marginBottom: 10
                }} />
              <div style={{ color, fontSize: 10, letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
                SQUADRA {label} ({team.length}/6)
              </div>
              {team.length === 0
                ? <div style={{ color: C.muted, fontSize: 12, fontStyle: "italic" }}>Nessuno</div>
                : team.map(p => (
                  <div key={p.id} style={{ color: C.text, fontSize: 13, padding: "2px 0" }}>· {p.name}</div>
                ))
              }
            </div>
          ))}
        </div>
      </Card>

      {/* Risultato */}
      <Card>
        <Label>RISULTATO</Label>
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          {[
            { name: nameA || "Squadra A", val: scoreA, set: setScoreA, color: C.accent },
            { name: nameB || "Squadra B", val: scoreB, set: setScoreB, color: C.red },
          ].map(({ name, val, set, color }, i) => (
            <div key={i} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <button onClick={() => set(Math.max(0, val - 1))} style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 20, cursor: "pointer"
                }}>−</button>
                <span style={{ color, fontSize: 48, fontWeight: 900, width: 52, textAlign: "center", lineHeight: 1 }}>{val}</span>
                <button onClick={() => set(val + 1)} style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 20, cursor: "pointer"
                }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Marcatori */}
      {(teamA.length > 0 || teamB.length > 0) && (scoreA > 0 || scoreB > 0) && (
        <Card>
          <Label>MARCATORI</Label>
          {[
            { team: teamA, score: scoreA, goals: goalsA, setGoals: setGoalsA, color: C.accent, name: nameA || "Squadra A", total: totalGoalsA },
            { team: teamB, score: scoreB, goals: goalsB, setGoals: setGoalsB, color: C.red, name: nameB || "Squadra B", total: totalGoalsB },
          ].map(({ team, score, goals, setGoals, color, name, total }) => (
            score > 0 && team.length > 0 && (
              <div key={name} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, color: total === score ? C.accent : total > score ? C.red : C.muted }}>
                    {total}/{score} gol {total === score ? "✓" : total > score ? "⚠ troppi" : ""}
                  </span>
                </div>
                {team.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: color + "20", border: `1px solid ${color}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color, fontSize: 12, fontWeight: 900
                    }}>{p.name[0]}</div>
                    <span style={{ color: C.text, fontSize: 14, flex: 1 }}>{p.name}</span>
                    <select
                      value={goals[p.id] || 0}
                      onChange={e => setGoals(g => ({ ...g, [p.id]: parseInt(e.target.value) }))}
                      style={{
                        background: C.surface, color: C.text, border: `1px solid ${C.border}`,
                        borderRadius: 8, padding: "5px 10px", fontSize: 14,
                        cursor: "pointer", outline: "none", minWidth: 60,
                      }}>
                      {Array.from({ length: score + 1 }, (_, i) => (
                        <option key={i} value={i}>{i === 0 ? "–" : `⚽ ${i}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )
          ))}
        </Card>
      )}

      {/* Salva */}
      <button onClick={handleSave} disabled={!canSave || saving} style={{
        background: canSave ? C.accent : C.border,
        color: canSave ? C.bg : C.muted,
        border: "none", borderRadius: 12, padding: "15px",
        fontWeight: 900, fontSize: 15, letterSpacing: 1,
        cursor: canSave ? "pointer" : "not-allowed",
        transition: "all 0.2s",
      }}>
        {saving ? "SALVATAGGIO..." : "SALVA PARTITA ✓"}
      </button>

    </div>
  )
}