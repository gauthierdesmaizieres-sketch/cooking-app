// First launch, no session yet: create the anonymous account (no email, no password), then App moves on.
import { useEffect, useState } from 'react'
import { Button } from '../ui.jsx'
import { startAnonymous } from '../data.js'

export default function Welcome() {
  const [failed, setFailed] = useState(false)
  const start = () => { setFailed(false); startAnonymous().catch(() => setFailed(true)) } // success -> auth listener in App
  useEffect(start, [])

  return (
    <div className="page login" aria-busy={!failed}>
      <h1>Ton journal repas</h1>
      {failed ? (
        <>
          <p role="alert">Impossible de préparer l'app. Vérifie ta connexion internet.</p>
          <Button size="lg" block onClick={start}>Réessayer</Button>
        </>
      ) : (
        <p className="muted">Préparation de ton journal…</p>
      )}
      <p className="muted credits"><a href="./privacy.html">Confidentialité</a></p>
    </div>
  )
}
