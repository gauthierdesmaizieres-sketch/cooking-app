// Sign in / sign up with a one-time email link (no password to store, reset or leak).
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { Button, EmptyState, TextField } from '../ui.jsx'
import { signIn } from '../data.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setState('sending')
    try {
      await signIn(email.trim())
      setState('sent')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="page login">
        <EmptyState icon={MailCheck} heading="h1" title="Regarde tes e-mails"
          text={`Un lien de connexion vient d'être envoyé à ${email.trim()}. Ouvre-le sur cet appareil.`}
          action={<Button variant="ghost" onClick={() => setState('idle')}>Changer d'adresse</Button>} />
      </div>
    )
  }

  return (
    <form className="page login" onSubmit={submit} noValidate>
      <h1>Ton journal repas</h1>
      <p className="muted">Entre ton e-mail : on t'envoie un lien pour te connecter, sans mot de passe. Le compte est créé à la première connexion.</p>
      <TextField id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" value={email}
        onChange={e => setEmail(e.target.value)}
        error={state === 'error' ? "L'envoi a échoué. Réessaie dans un instant." : undefined} />
      <Button size="lg" block type="submit" loading={state === 'sending'} disabled={!valid}>Recevoir le lien</Button>
      <p className="muted credits"><a href="./privacy.html">Confidentialité</a></p>
    </form>
  )
}
