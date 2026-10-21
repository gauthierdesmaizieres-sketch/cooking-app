// Sign in / sign up by email: a 6-digit code typed in the app (works in any browser and in the installed
// app), with the email link as a fallback. No password to store, reset or leak.
import { useState } from 'react'
import { Button, TextField } from '../ui.jsx'
import { signIn, verifyCode } from '../data.js'
import { arrivedFromLink } from '../supabase.js'

const KEY = 'cooking-app:login'
const remembered = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s && Date.now() - s.at < 3600_000 ? s.email : '' // codes expire after an hour
  } catch { return '' }
}
const remember = email => { try { email ? localStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() })) : localStorage.removeItem(KEY) } catch { /* private mode */ } }

// A failed email link comes back as ?error_description=… or #error_description=…; read it once, then clean the URL.
function linkError() {
  const p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#\/?/, ''))
  const msg = p.get('error_description') || p.get('error') || (arrivedFromLink && 'exchange failed')
  if (msg) history.replaceState(null, '', location.pathname)
  return msg ? "Ce lien ne marche pas ici (ouvert dans un autre navigateur, déjà utilisé ou expiré). Retourne dans l'app où tu as demandé le code et tape le code à 6 chiffres de l'e-mail, ou demande un nouveau code ici." : null
}

export default function Login() {
  const [email, setEmail] = useState(remembered)
  const [step, setStep] = useState(() => (remembered() ? 'code' : 'email')) // email | code
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError)
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const digits = code.replace(/\D/g, '')
  const validCode = digits.length >= 6 && digits.length <= 10

  async function send(e) {
    e.preventDefault()
    if (!validEmail) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim())
      remember(email.trim())
      setStep('code')
    } catch {
      setError("L'envoi a échoué. Attends une minute et réessaie : le nombre d'e-mails par heure est limité.")
    }
    setBusy(false)
  }

  async function check(e) {
    e.preventDefault()
    if (!validCode) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email.trim(), digits) // on success the auth listener in App swaps this screen out
      remember(null)
    } catch {
      setError('Code incorrect ou expiré. Vérifie le dernier e-mail reçu, ou demande un nouveau code.')
      setBusy(false)
    }
  }

  if (step === 'code') {
    return (
      <form className="page login" onSubmit={check} noValidate>
        <h1>Regarde tes e-mails</h1>
        <p className="muted">Un code vient d'être envoyé à {email.trim()}. Tape-le ici : pas besoin d'ouvrir le lien.</p>
        <TextField id="code" label="Code reçu par e-mail" inputMode="numeric" autoComplete="one-time-code" value={code}
          onChange={e => setCode(e.target.value)} error={error ?? undefined} />
        <Button size="lg" block type="submit" loading={busy} disabled={!validCode}>Me connecter</Button>
        <Button variant="ghost" type="button" onClick={() => { setStep('email'); setCode(''); setError(null); remember(null) }}>
          Changer d'adresse ou renvoyer un code
        </Button>
      </form>
    )
  }

  return (
    <form className="page login" onSubmit={send} noValidate>
      <h1>Ton journal repas</h1>
      <p className="muted">Entre ton e-mail : on t'envoie un code pour te connecter, sans mot de passe. Le compte est créé à la première connexion.</p>
      <TextField id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" value={email}
        onChange={e => setEmail(e.target.value)} error={error ?? undefined} />
      <Button size="lg" block type="submit" loading={busy} disabled={!validEmail}>Recevoir un code</Button>
      <p className="muted credits"><a href="./privacy.html">Confidentialité</a></p>
    </form>
  )
}
