import { useState, useCallback } from "react"
import { supabase } from "../supabaseClient"
import { useAuth } from "../AuthContext"
import Cropper from "react-easy-crop"

const C = {
  bg: "#0a0a0f", card: "#1a1a24", border: "#2a2a3a",
  accent: "#00e676", text: "#f0f0f0", muted: "#6b6b8a", surface: "#13131a",
}

// Utility per ritagliare l'immagine
async function getCroppedImg(imageSrc, croppedAreaPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas = document.createElement("canvas")
  const size = 300
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")

  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0, size, size
  )

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.9)
  })
}

export default function Setup({ onComplete }) {
  const { user } = useAuth()
  const [name, setName] = useState(user?.user_metadata?.name?.split(" ")[0] || "")
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cropping, setCropping] = useState(false)
  const [saving, setSaving] = useState(false)

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result)
      setCropping(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirmCrop = async () => {
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
    setPreview(URL.createObjectURL(blob))
    setCropping(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)

    let avatar_url = null

    if (preview) {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      const path = `${user.id}/avatar.jpg`
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" })

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path)
        avatar_url = data.publicUrl
      }
    }

    const { error } = await supabase.from("players").insert({
      name: name.trim(),
      user_id: user.id,
      avatar_url,
    })

    if (error) { alert("Errore: " + error.message); setSaving(false); return }
    onComplete()
  }

  // Schermata crop
  if (cropping) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Zoom slider */}
      <div style={{ background: C.card, padding: "16px 24px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>
          ZOOM
        </div>
        <input
          type="range" min={1} max={3} step={0.05}
          value={zoom}
          onChange={e => setZoom(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: C.accent }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <button onClick={() => setCropping(false)} style={{
            background: "transparent", color: C.muted,
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "12px", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>Annulla</button>
          <button onClick={handleConfirmCrop} style={{
            background: C.accent, color: C.bg, border: "none",
            borderRadius: 10, padding: "12px", fontWeight: 900,
            fontSize: 14, cursor: "pointer",
          }}>Conferma ✓</button>
        </div>
      </div>
    </div>
  )

  // Schermata setup
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👋</div>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Benvenuto!</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Come vuoi essere chiamato?</div>
        </div>

        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {/* Foto */}
          <div style={{ textAlign: "center" }}>
            <label htmlFor="avatar-upload" style={{ cursor: "pointer" }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%", margin: "0 auto 10px",
                background: C.accent + "20", border: `3px solid ${C.accent}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {preview
                  ? <img src={preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 32 }}>📷</span>
                }
              </div>
              <div style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>
                {preview ? "Cambia foto" : "Aggiungi foto"}
              </div>
            </label>
            <input
              id="avatar-upload" type="file" accept="image/*"
              onChange={handlePhoto} style={{ display: "none" }}
            />
          </div>

          {/* Nome */}
          <div>
            <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>IL TUO NOME</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Es. Marco"
              maxLength={20}
              style={{
                width: "100%", background: C.surface, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: 10,
                padding: "12px 14px", fontSize: 16, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button onClick={handleSave} disabled={!name.trim() || saving} style={{
            background: name.trim() ? C.accent : C.border,
            color: name.trim() ? C.bg : C.muted,
            border: "none", borderRadius: 10, padding: "14px",
            fontWeight: 900, fontSize: 15,
            cursor: name.trim() ? "pointer" : "not-allowed",
          }}>
            {saving ? "Salvataggio..." : "INIZIA →"}
          </button>
        </div>
      </div>
    </div>
  )
}