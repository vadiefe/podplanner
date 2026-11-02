import { useState } from 'react'
import { Card, SectionTitle, Btn, Metrics, MetricCard, Empty } from '../components/UI.jsx'
import { bapi, money } from './api.js'
import s from './booker.module.css'

export default function MatchPage({ shows, brief, match, setMatch, onNext, onBack }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError('')
    try {
      const r = await bapi.match(shows, brief)
      setMatch(r)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }
  const upd = (i, patch) => setMatch(m => ({ ...m, selections: m.selections.map((x, j) => j === i ? { ...x, ...patch } : x) }))
  const sel = match?.selections || []
  const chosen = sel.filter(x => x.included)
  const total = chosen.reduce((a, x) => a + (x.price || 0), 0)
  const unpriced = chosen.filter(x => !x.price).length
  const reach = chosen.reduce((a, x) => a + (x.listenersPerEp || 0), 0)

  return (
    <div className="fade-in">
      <Card>
        <div className={s.tableHead}>
          <SectionTitle>Matches for {brief.brandName}</SectionTitle>
          <Btn primary onClick={generate} disabled={loading}>
            {loading ? <><i className="ti ti-loader spin" /> Matching…</> : match ? 'Regenerate matches' : 'Find matching shows'}
          </Btn>
        </div>
        {error && <div className={`${s.status} ${s.error}`}>{error}</div>}
        {!match && !loading && <Empty icon="ti-sparkles" title="No matches yet" sub={`AI will scan your ${shows.length} shows and pick the best fits for this brief.`} />}
        {match?.summary && <p className={s.summary}>{match.summary}</p>}
      </Card>

      {match && (<>
        <Metrics>
          <MetricCard label="Total offer price" value={money(total)} />
          <MetricCard label="Shows selected" value={chosen.length} />
          <MetricCard label="Combined ep. listeners" value={reach ? reach.toLocaleString() : '—'} />
          <MetricCard label="Need a quote" value={unpriced} color={unpriced ? 'var(--amber)' : undefined} />
        </Metrics>
        <Card>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th></th><th>Podcast</th><th>Fit</th><th>Why / pitch angle</th><th>Format</th><th>Ep. listeners</th><th>Host cost</th><th>Offer price</th><th>Host email</th></tr></thead>
              <tbody>
                {sel.map((x, i) => (
                  <tr key={x.id + i} style={{ opacity: x.included ? 1 : 0.45 }}>
                    <td><input type="checkbox" checked={x.included} onChange={e => upd(i, { included: e.target.checked })} /></td>
                    <td><strong>{x.podcastName}</strong><div className={s.sub}>{x.category}{x.location ? ' · ' + x.location : ''}</div></td>
                    <td>{x.fitScore}/10</td>
                    <td className={s.wide}>{x.reason}<div className={s.sub}><em>Pitch:</em> {x.pitchAngle}</div></td>
                    <td>{x.format}</td>
                    <td>{x.listenersPerEp ? x.listenersPerEp.toLocaleString() : '—'}</td>
                    <td className={s.internal}>{x.hostCost ? money(x.hostCost) : '—'}</td>
                    <td><input className={s.priceInput} type="number" value={x.price || ''} placeholder="quote" onChange={e => upd(i, { price: parseFloat(e.target.value) || 0 })} /></td>
                    <td className={s.email}>{x.hostEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.hint}>"Host cost" and host email are internal and never appear in the client offer. Offer price already includes your service fee; you can edit it.</p>
        </Card>
      </>)}

      <div className={s.actions}><Btn onClick={onBack}><i className="ti ti-arrow-left" />Back</Btn><Btn primary disabled={!chosen.length} onClick={onNext}>Next: Offer <i className="ti ti-arrow-right" /></Btn></div>
    </div>
  )
}
