// Design-system primitives. Specs: replica/design/components.md. Colours only via tokens.css vars.
import { useEffect, useRef } from 'react'
import { Loader2, Minus, Plus, Search, X } from 'lucide-react'

export function Button({ variant = 'primary', size = 'md', loading = false, block = false, children, ...rest }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}`}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="spin" size={18} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({ label, icon: Icon, variant = 'plain', ...rest }) {
  return (
    <button className={`icon-btn icon-btn-${variant}`} aria-label={label} title={label} {...rest}>
      <Icon size={22} aria-hidden="true" />
    </button>
  )
}

// Ring arc = eaten/goal; over goal turns danger and shows "+n" so state isn't colour-only.
export function CalorieRing({ eaten, goal, size = 'lg' }) {
  const px = size === 'lg' ? 200 : 40
  const stroke = size === 'lg' ? 14 : 5
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const left = Math.round(goal - eaten)
  const state = eaten === 0 ? 'empty' : left < 0 ? 'over' : left === 0 ? 'done' : 'under'
  const label = left < 0 ? `${-left} kcal de trop, objectif ${goal}` : `${left} kcal restantes sur ${goal}`
  return (
    <div className={`ring ring-${size} ring-${state}`} role="img" aria-label={label} style={{ width: px, height: px }}>
      <svg width={px} height={px} aria-hidden="true">
        <circle className="ring-track" cx={px / 2} cy={px / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-arc" cx={px / 2} cy={px / 2} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${px / 2} ${px / 2})`} />
      </svg>
      {size === 'lg' && (
        <div className="ring-center" aria-hidden="true">
          <strong>{left < 0 ? `+${-left}` : left}</strong>
          <span>{left < 0 ? 'kcal de trop' : 'kcal restantes'}</span>
        </div>
      )}
    </div>
  )
}

export function MacroBar({ kind, label, value, goal }) {
  const over = value > goal
  return (
    <div className={`macro macro-${kind}`}>
      <div className="macro-head">
        <span>{label}</span>
        <span className={over ? 'macro-over' : ''}>{Math.round(value)} / {goal} g</span>
      </div>
      <progress max={goal} value={Math.min(value, goal)} aria-label={`${label} ${Math.round(value)} sur ${goal} g`} />
    </div>
  )
}

export function FoodRow({ name, detail, kcal, badge, onClick }) {
  return (
    <button className="food-row" onClick={onClick}>
      <span className="food-row-text">
        <span className="food-row-name">{name}</span>
        <span className="food-row-detail">{detail}</span>
      </span>
      {badge && <span className="badge badge-warning">{badge}</span>}
      <span className="food-row-kcal">{kcal} kcal</span>
    </button>
  )
}

export function MealCard({ title, kcal, children, onAdd }) {
  return (
    <section className="card meal-card" aria-label={title}>
      <header className="meal-head">
        <h2>{title}</h2>
        <span className="muted">{kcal} kcal</span>
      </header>
      {children}
      <Button variant="ghost" size="sm" onClick={onAdd} aria-label={`Ajouter un aliment : ${title}`}>
        <Plus size={16} aria-hidden="true" /> Ajouter
      </Button>
    </section>
  )
}

export function SearchField({ value, onChange, label = 'Rechercher', loading }) {
  return (
    <div className="search">
      <Search size={18} aria-hidden="true" />
      <input type="search" aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} />
      {loading ? <Loader2 className="spin" size={18} aria-hidden="true" />
        : value && <button className="search-clear" aria-label="Effacer" onClick={() => onChange('')}><X size={16} aria-hidden="true" /></button>}
    </div>
  )
}

export function TextField({ id, label, error, suffix, ...rest }) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-box">
        <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {error && <p id={`${id}-err`} className="field-msg">{error}</p>}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max = 99, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Diminuer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={18} aria-hidden="true" /></button>
      <output aria-live="polite">{value}</output>
      <button aria-label={`Augmenter ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={18} aria-hidden="true" /></button>
    </div>
  )
}

export function Chip({ on, children, ...rest }) {
  return <button className={`chip${on ? ' chip-on' : ''}`} aria-pressed={on} {...rest}>{children}</button>
}

// Native <dialog>: focus trap, Esc to close and focus return come from the browser.
export function BottomSheet({ open, onClose, title, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={e => e.target === ref.current && onClose()} aria-label={title}>
      <header className="sheet-head">
        <h2>{title}</h2>
        <IconButton label="Fermer" icon={X} onClick={onClose} />
      </header>
      {children}
    </dialog>
  )
}

export function Toast({ children, action, onAction }) {
  return (
    <div className="toast" role="status">
      <span>{children}</span>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  )
}

// heading: 'h1' when the empty state is the whole screen (e.g. after sending the login link)
export function EmptyState({ icon: Icon, title, text, action, heading: H = 'h3' }) {
  return (
    <div className="empty">
      <Icon size={32} aria-hidden="true" />
      <H>{title}</H>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function TabBar({ items, current, onChange }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} aria-current={current === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

// rows: [[label, value, unit]] — a real table so screen readers announce "Glucides, 12 g".
export function NutritionLabel({ caption, rows }) {
  return (
    <table className="nutri">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([label, value, unit]) => (
          <tr key={label}><th scope="row">{label}</th><td>{value ?? '–'}{value == null ? '' : ` ${unit}`}</td></tr>
        ))}
      </tbody>
    </table>
  )
}
