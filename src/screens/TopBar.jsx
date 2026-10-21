import { ArrowLeft } from 'lucide-react'
import { IconButton } from '../ui.jsx'

// Header for flow screens (no tab bar): back + title.
export default function TopBar({ title, onBack }) {
  return (
    <header className="topbar">
      <IconButton label="Retour" icon={ArrowLeft} onClick={onBack ?? (() => history.back())} />
      <h1>{title}</h1>
    </header>
  )
}
