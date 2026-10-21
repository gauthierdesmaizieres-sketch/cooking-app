import { Hammer } from 'lucide-react'
import { EmptyState } from '../ui.jsx'

export default function Stub({ title, ids }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <EmptyState icon={Hammer} title="Pas encore construit" text={`Écrans ${ids}, prévus après le parcours principal.`} />
    </div>
  )
}
