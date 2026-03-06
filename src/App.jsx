import { useState } from "react"
import { useAuth } from "./AuthContext"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Classifica from "./pages/Classifica"
import Marcatori from "./pages/Marcatori"
import Storico from "./pages/Storico"
import Pagelle from "./pages/Pagelle"
import Profilo from "./pages/Profilo"
import NuovaPartita from "./pages/NuovaPartita"
import Setup from "./pages/Setup"
import { useSignedUrl } from "./hooks/useSignedUrl"

const NAV = [
  { id: "home", label: "Home", icon: "⚽" },
  { id: "classifica", label: "Classifica", icon: "🏆" },
  { id: "marcatori", label: "Marcatori", icon: "👟" },
  { id: "storico", label: "Storico", icon: "📅" },
  { id: "pagelle", label: "Pagelle", icon: "🗳️" },
  { id: "profilo", label: "Profilo", icon: "👤" },
  { id: "nuova", label: "Nuova", icon: "➕" },
]

function HeaderAvatar({ player, onSignOut }) {
  const avatarUrl = useSignedUrl(player?.avatar_url)
  return (
    <button onClick={onSignOut} style={{
      width: 38, height: 38, borderRadius: "50%",
      background: "#00e67620", border: "2px solid #00e67640",
      overflow: "hidden", cursor: "pointer", padding: 0,
    }}>
      {avatarUrl
        ? <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ color: "#00e676", fontWeight: 900, fontSize: 15 }}>
            {player?.name?.[0]?.toUpperCase()}
          </span>
      }
    </button>
  )
}

export default function App() {
  const [page, setPage] = useState("home")
  const { user, player, loading, signOut, refreshPlayer } = useAuth()

  if (loading) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00e676", fontSize: 32 }}>⚽</div>
    </div>
  )

  if (!user) return <Login />
  if (!player) return <Setup onComplete={refreshPlayer} />


  const current = NAV.find(n => n.id === page)
  
  const pages = {
    home: <Home onNavigate={setPage} />,
    classifica: <Classifica />,
    marcatori: <Marcatori />,
    storico: <Storico />,
    pagelle: <Pagelle />,
    profilo: <Profilo />,
    nuova: <NuovaPartita />,
  }

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", maxWidth: 420, margin: "0 auto", position: "relative", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        background: "#13131a", borderBottom: "1px solid #2a2a3a",
        padding: "14px 20px", position: "sticky", top: 0, zIndex: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ color: "#00e676", fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>IL CALCETTO</div>
          <div style={{ color: "#f0f0f0", fontSize: 17, fontWeight: 900 }}>{current?.icon} {current?.label}</div>
        </div>
        <HeaderAvatar player={player} onSignOut={signOut} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "16px 16px 90px" }}>
        {pages[page]}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 420,
        background: "#13131a", borderTop: "1px solid #2a2a3a",
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", zIndex: 20,
      }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setPage(item.id)} style={{
            background: "transparent", border: "none",
            padding: "10px 4px 12px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            cursor: "pointer",
          }}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: page === item.id ? "#00e676" : "#6b6b8a" }}>
              {item.label}
            </span>
            {page === item.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#00e676" }} />}
          </button>
        ))}
      </div>
    </div>
  )
}