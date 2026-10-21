// Bits shared by the recipe screens (S12–S15).
import { useEffect, useState } from 'react'
import { CookingPot } from 'lucide-react'
import { photoUrl } from '../data.js'

export const TAGS = [
  ['vegetarien', 'Végétarien'],
  ['vegan', 'Vegan'],
  ['low-carb', 'Peu de glucides'],
  ['sans-gluten', 'Sans gluten'],
]
export const tagLabel = t => TAGS.find(([id]) => id === t)?.[1] ?? t

// Private bucket: photos are shown through short-lived signed URLs.
export function useSignedUrl(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (path) photoUrl(path).then(u => live && setUrl(u)).catch(() => {})
    return () => { live = false }
  }, [path])
  return url
}

export function RecipePhoto({ path, src, alt, className = '' }) {
  const signed = useSignedUrl(src ? null : path)
  const url = src ?? signed
  return (
    <div className={`recipe-photo ${className}`}>
      {url ? <img src={url} alt={alt} /> : <CookingPot size={36} aria-hidden="true" />}
    </div>
  )
}
