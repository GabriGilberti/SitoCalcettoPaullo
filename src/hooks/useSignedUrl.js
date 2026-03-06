import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

export function useSignedUrl(path) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!path) return
    // Se è già un URL completo (vecchie foto), usalo direttamente
    if (path.startsWith("http")) { setUrl(path); return }

    supabase.storage.from("Avatars")
      .createSignedUrl(path, 3600) // valido 1 ora
      .then(({ data }) => { if (data) setUrl(data.signedUrl) })
  }, [path])

  return url
}