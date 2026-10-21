// S19 Profil (slice: account only — sign out, delete account)
import { useState } from 'react'
import { BottomSheet, Button } from '../ui.jsx'
import { deleteAccount, signOut } from '../data.js'
import { go } from '../App.jsx'

export default function Profile({ email }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function remove() {
    setBusy(true)
    setError(false)
    try {
      await deleteAccount() // auth listener in App sends us back to the login screen
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Profil</h1>
      <section className="card stack">
        <p className="muted">Connecté avec</p>
        <p>{email}</p>
        <Button variant="secondary" onClick={signOut}>Se déconnecter</Button>
      </section>
      <section className="card stack">
        <p className="muted">Objectif, poids, activité</p>
        <Button variant="secondary" onClick={() => go('/goals')}>Modifier mes objectifs</Button>
      </section>
      <Button variant="ghost" onClick={() => setConfirm(true)}>Supprimer mon compte</Button>
      <p className="muted credits">
        Valeurs nutritionnelles : <a href="https://ciqual.anses.fr" target="_blank" rel="noreferrer">Anses. 2025. Table de composition nutritionnelle des aliments Ciqual</a> (Licence Ouverte) ·
        produits : <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL).
        <br /><a href="./privacy.html">Confidentialité</a>
      </p>

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title="Supprimer le compte ?">
        <div className="stack">
          <p>Ton journal, tes plats, tes photos et ton compte seront effacés définitivement. Impossible de revenir en arrière.</p>
          {error && <p className="form-error" role="alert">La suppression a échoué. Réessaie.</p>}
          <Button variant="danger" block loading={busy} onClick={remove}>Supprimer définitivement</Button>
          <Button variant="secondary" block disabled={busy} onClick={() => setConfirm(false)}>Annuler</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
