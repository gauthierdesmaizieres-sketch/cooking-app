// Sign in / sign up with a one-time email link (no password to store, reset or leak).
// The link works in any browser on the phone; the app picks the session up when you come back to it.
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { Button, EmptyState, TextField } from '../ui.jsx'
import { signIn } from '../data.js'

// A failed link comes back as #error_description=… (or ?error_description=…); read it once, then clean the URL.
function linkError() {
  const p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#\/?/, ''))
  if (!p.get('error_description') && !p.get('error')) return null
  history.replaceState(null, '', location.pathname)
  return 'Ce lien a expiré ou a déjà servi. Demande un nouveau lien.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(linkError)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setState('sending')
    setError(null)
    try {
      await signIn(email.trim())
      setState('sent')
    } catch {
      setState('idle')
      setError("L'envoi a échoué. Attends une minute et réessaie : le nombre d'e-mails par heure est limité.")
    }
  }

  if (state === 'sent') {
    return (
      <div className="page login">
        <EmptyState icon={MailCheck} heading="h1" title="Regarde tes e-mails"
          text={`Un lien de connexion vient d'être envoyé à ${email.trim()}. Ouvre-le sur ce téléphone, depuis n'importe quelle app : tu seras connecté, puis reviens ici.`}
          action={<Button variant="ghost" onClick={() => setState('idle')}>Changer d'adresse</Button>} />
      </div>
    )
  }

  return (
    <form className="page login" onSubmit={submit} noValidate>
      <h1>Ton journal repas</h1>
      <p className="muted">Entre ton e-mail : on t'envoie un lien pour te connecter, sans mot de passe. Le compte est créé à la première connexion.</p>
      <TextField id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" value={email}
        onChange={e => setEmail(e.target.value)} error={error ?? undefined} />
      <Button size="lg" block type="submit" loading={state === 'sending'} disabled={!valid}>Recevoir le lien</Button>
      <p className="muted credits"><a href="./privacy.html">Confidentialité</a></p>
    </form>
  )
}
