import s from './UI.module.css'

export function Card({ children, style, accent }) {
  return <div className={`${s.card} ${accent ? s.cardAccent : ''}`} style={style}>{children}</div>
}

export function SectionTitle({ children }) {
  return <p className={s.sectionTitle}>{children}</p>
}

export function Btn({ children, primary, danger, sm, disabled, onClick, style }) {
  return (
    <button
      className={[s.btn, primary ? s.btnPrimary : '', danger ? s.btnDanger : '', sm ? s.btnSm : ''].join(' ')}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  )
}

export function FormGroup({ label, children }) {
  return (
    <div className={s.formGroup}>
      {label && <label className={s.label}>{label}</label>}
      {children}
    </div>
  )
}

export function Input(props) {
  return <input className={s.input} {...props} />
}

export function Select({ children, ...props }) {
  return <select className={s.input} {...props}>{children}</select>
}

export function Textarea(props) {
  return <textarea className={s.textarea} {...props} />
}

export function Row({ children, gap }) {
  return <div className={s.row} style={gap ? { gap } : {}}>{children}</div>
}

export function Col({ children }) {
  return <div className={s.col}>{children}</div>
}

export function Tag({ children, color }) {
  const cls = { green: s.tagGreen, blue: s.tagBlue, amber: s.tagAmber }[color] || ''
  return <span className={`${s.tag} ${cls}`}>{children}</span>
}

export function MetricCard({ label, value, color }) {
  return (
    <div className={s.metricCard}>
      <div className={s.metricLabel}>{label}</div>
      <div className={s.metricVal} style={color ? { color } : {}}>{value}</div>
    </div>
  )
}

export function Empty({ icon, title, sub, children }) {
  return (
    <div className={s.empty}>
      <i className={`ti ${icon}`} aria-hidden="true" />
      <p className={s.emptyTitle}>{title}</p>
      {sub && <p className={s.emptySub}>{sub}</p>}
      {children}
    </div>
  )
}

export function Metrics({ children }) {
  return <div className={s.metrics}>{children}</div>
}
