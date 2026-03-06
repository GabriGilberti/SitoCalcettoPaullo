import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"

export function useSignedUrl(path) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!path) return
    if (path.startsWith("http")) { setUrl(path); return }

    supabase.storage.from("Avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl) })
  }, [path])

  return url
}