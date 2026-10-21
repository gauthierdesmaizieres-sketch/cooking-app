// S19 Profil (slice: goals, access code, delete account). The account is anonymous: no sign-out (it would lose it).
import { useState } from 'react'
import { BottomSheet, Button } from '../ui.jsx'
import { deleteAccount, getAccessCode, setAccessCode } from '../data.js'
import { go } from '../App.jsx'

export default function Profile({ notify }) {
  const [confirm, setConfirm] = useState(false)
  const [hasCode, setHasCode] = useState(() => !!getAccessCode())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function remove() {
    setBusy(true)
    setError(false)
    try {
      await deleteAccount() // auth listener in App starts a fresh account
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Profil</h1>
      <section className="card stack">
        <p className="muted">Ton compte</p>
        <p>Il est lié à ce navigateur, sans e-mail ni mot de passe. Si tu effaces les données de Chrome ou changes de téléphone, ton journal sera perdu.</p>
      </section>
      <section className="card stack">
        <p className="muted">Objectif, poids, activité</p>
        <Button variant="secondary" onClick={() => go('/goals')}>Modifier mes objectifs</Button>
      </section>
      {hasCode && (
        <section className="card stack">
          <p className="muted">Analyse photo</p>
          <Button variant="secondary" onClick={() => { setAccessCode(null); setHasCode(false); notify?.("Code d'accès oublié sur ce téléphone") }}>
            Oublier le code d'accès
          </Button>
        </section>
      )}
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
