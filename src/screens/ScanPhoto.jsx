// S08 Scan photo IA
import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import { Button, TextField } from '../ui.jsx'
import { mealLabel } from '../lib.js'
import { getAccessCode, scanPhoto, setAccessCode } from '../data.js'
import { go } from '../App.jsx'
import TopBar from './TopBar.jsx'

const ERRORS = {
  'not-image': "Cette image ne peut pas être lue. Essaie une photo JPEG ou PNG.",
  limit: "Tu as atteint la limite d'analyses pour aujourd'hui. Ajoute ton repas par la recherche.",
  refused: "Cette photo n'a pas pu être analysée. Essaie une autre prise de vue.",
  busy: "Le service d'analyse est saturé. Réessaie dans une minute.",
  network: "L'analyse a échoué. Vérifie ta connexion et réessaie.",
}

export default function ScanPhoto({ meal, q }) {
  const day = q.get('day') ?? ''
  const camRef = useRef(null)
  const galRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [askCode, setAskCode] = useState(false) // server said the access code is missing or wrong
  const [code, setCode] = useState(getAccessCode)

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setError("Ce fichier n'est pas une image."); return }
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function analyse() {
    setBusy(true)
    setError(null)
    try {
      const { scan_id } = await scanPhoto(file)
      go(`/review/${scan_id}?meal=${meal}&day=${day}`)
    } catch (e) {
      if (e.message === 'code') {
        setAskCode(true)
        setError(getAccessCode() ? "Code d'accès incorrect." : null)
      } else setError(ERRORS[e.message] ?? ERRORS.network)
      setBusy(false)
    }
  }

  function saveCode(e) {
    e.preventDefault()
    if (!code.trim()) return
    setAccessCode(code.trim())
    setAskCode(false)
    analyse()
  }

  return (
    <div className="page">
      <TopBar title={`Photo · ${mealLabel(meal)}`} />
      {/* capture= opens the rear camera on phones; desktop falls back to a file picker */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={pick} />

      {preview ? (
        <figure className="scan-preview">
          <img src={preview} alt="Photo du plat à analyser" />
        </figure>
      ) : (
        <div className="scan-empty card">
          <Camera size={40} aria-hidden="true" />
          <p>Prends ton assiette en photo, vue du dessus, en entier dans le cadre.</p>
        </div>
      )}

      {askCode ? (
        <form className="card stack" onSubmit={saveCode}>
          <p>L'analyse photo est réservée au propriétaire de l'app. Entre ton code d'accès : il sera retenu sur ce téléphone.</p>
          <TextField id="access-code" label="Code d'accès" type="password" autoComplete="current-password" value={code}
            onChange={e => setCode(e.target.value)} error={error ?? undefined} />
          <Button type="submit" block disabled={!code.trim()}>Valider et analyser</Button>
        </form>
      ) : error && <p className="form-error" role="alert">{error}</p>}

      <div className="stack">
        {preview && !askCode && <Button size="lg" block loading={busy} onClick={analyse}>{busy ? "Analyse… (jusqu'à 1 min)" : 'Analyser le plat'}</Button>}
        <div className="add-actions">
          <Button variant={preview ? 'secondary' : 'primary'} disabled={busy} onClick={() => camRef.current.click()}>
            <Camera size={18} aria-hidden="true" /> {preview ? 'Reprendre' : 'Appareil photo'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => galRef.current.click()}>
            <ImagePlus size={18} aria-hidden="true" /> Galerie
          </Button>
        </div>
        <p className="muted">L'estimation est approximative : tu pourras corriger chaque aliment avant de l'ajouter.</p>
      </div>
    </div>
  )
}
