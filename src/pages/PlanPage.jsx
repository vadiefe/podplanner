import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, SectionTitle, Btn, Metrics, MetricCard, Tag, Empty } from '../components/UI.jsx'
import s from './PlanPage.module.css'

const COLORS = ['#378add', '#639922', '#d85a30', '#d4537e', '#ba7517', '#533ab7', '#1d9e75', '#888780', '#378add', '#639922', '#d85a30', '#d4537e']

export default function PlanPage({ podcasts, brief, plan, setPlan, onNext, onBack }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const hasRun = useRef(false)

  useEffect(() => {
    if (!plan && !loading && !hasRun.current) {
      hasRun.current = true
      generate()
    }
  }, [])

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podcasts, brief })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan({ ...data, totalBudget: parseFloat(brief.budget) })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function regenerate() {
    hasRun.current = false
    setPlan(null)
    generate()
  }

  function updateBudget(idx, val) {
    setPlan(p => {
      const sels = [...p.selections]
      const cpm = sels[idx].cpm || 25
      const budget = parseFloat(val) || 0
      sels[idx] = { ...sels[idx], allocatedBudget: budget, impressions: Math.round((budget / cpm) * 1000) }
      return { ...p, selections: sels }
    })
  }

  function removeRow(idx) {
    setPlan(p => ({ ...p, selections: p.selections.filter((_, i) => i !== idx) }))
  }

  if (loading) return (
    <Card>
      <div className={s.loadState}>
        <i className="ti ti-loader spin" style={{ fontSize: 32 }} />
        <p className={s.loadTitle}>Generating your media plan…</p>
        <p className={s.loadSub}>Matching {podcasts.length} shows to your brief</p>
      </div>
    </Card>
  )

  if (error) return (
    <Card>
      <Empty icon="ti-alert-circle" title="Could not generate plan" sub={error}>
        <Btn primary style={{ marginTop: 14 }} onClick={generate}>
          <i className="ti ti-refresh" />Try again
        </Btn>
      </Empty>
    </Card>
  )

  if (!plan) return null

  const totalAlloc = plan.selections.reduce((a, s) => a + s.allocatedBudget, 0)
  const totalImp = plan.selections.reduce((a, s) => a + s.impressions, 0)
  const remaining = plan.totalBudget - totalAlloc
  const effCPM = totalImp > 0 ? (totalAlloc / (totalImp / 1000)) : 0

  const chartData = plan.selections.map(s => ({
    name: s.podcastName.length > 22 ? s.podcastName.slice(0, 22) + '…' : s.podcastName,
    budget: s.allocatedBudget,
    fullName: s.podcastName
  }))

  return (
    <div className="fade-in">
      {/* Rationale */}
      <Card>
        <SectionTitle>Strategy rationale</SectionTitle>
        <p className={s.rationale}>{plan.rationale}</p>
        <Btn sm onClick={regenerate} style={{ marginTop: 12 }}>
          <i className="ti ti-refresh" />Regenerate plan
        </Btn>
      </Card>

      {/* Metrics */}
      <Metrics>
        <MetricCard label="Total budget" value={`$${plan.totalBudget.toLocaleString()}`} />
        <MetricCard label="Allocated" value={`$${Math.round(totalAlloc).toLocaleString()}`} color={remaining < 0 ? 'var(--red)' : undefined} />
        <MetricCard label="Remaining" value={`$${Math.round(remaining).toLocaleString()}`} color={remaining < 0 ? 'var(--red)' : 'var(--green)'} />
        <MetricCard label="Est. impressions" value={`${(totalImp / 1000).toFixed(0)}k`} />
        <MetricCard label="Shows" value={plan.selections.length} />
        <MetricCard label="Eff. CPM" value={effCPM > 0 ? `$${effCPM.toFixed(2)}` : '—'} />
      </Metrics>

      {/* Budget bar */}
      <Card>
        <SectionTitle>Budget allocation by show</SectionTitle>
        <div className={s.budgetProgress}>
          <div className={s.budgetLabels}>
            <span>Allocated ${Math.round(totalAlloc).toLocaleString()} of ${plan.totalBudget.toLocaleString()}</span>
            <span style={{ color: remaining < 0 ? 'var(--red)' : 'var(--text-2)' }}>
              {((totalAlloc / plan.totalBudget) * 100).toFixed(0)}%
            </span>
          </div>
          <div className={s.progressTrack}>
            <div className={s.progressFill} style={{
              width: Math.min(100, (totalAlloc / plan.totalBudget) * 100) + '%',
              background: remaining < 0 ? 'var(--red)' : 'var(--green)'
            }} />
          </div>
        </div>

        <div className={s.chart}>
          <ResponsiveContainer width="100%" height={Math.max(160, plan.selections.length * 36)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={160} />
              <Tooltip
                formatter={(val, _, props) => [`$${val.toLocaleString()}`, props.payload.fullName]}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '0.5px solid var(--border)' }}
              />
              <Bar dataKey="budget" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Editable table */}
      <Card>
        <SectionTitle>Media plan — adjust budget allocations, then export</SectionTitle>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Show</th><th>Category</th><th>Listeners</th><th>CPM</th>
                <th>Format</th><th>Spots/wk</th><th>Budget ($)</th><th>Impressions</th><th>Why selected</th><th />
              </tr>
            </thead>
            <tbody>
              {plan.selections.map((row, i) => (
                <tr key={i}>
                  <td className={s.bold}>{row.podcastName}</td>
                  <td>{row.podcastCategory ? <Tag color="blue">{row.podcastCategory}</Tag> : '—'}</td>
                  <td>{row.listeners ? row.listeners.toLocaleString() : '—'}</td>
                  <td>{row.cpm ? `$${row.cpm.toFixed(2)}` : '—'}</td>
                  <td><Tag color="green">{row.adFormat}</Tag></td>
                  <td className={s.center}>{row.spotsPerWeek}</td>
                  <td>
                    <input
                      className={s.budgetInput}
                      type="number"
                      value={row.allocatedBudget}
                      onChange={e => updateBudget(i, e.target.value)}
                    />
                  </td>
                  <td>{row.impressions.toLocaleString()}</td>
                  <td className={s.reason}>{row.reason}</td>
                  <td>
                    <button className={s.removeBtn} onClick={() => removeRow(i)} title="Remove">
                      <i className="ti ti-x" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className={s.actions}>
        <Btn onClick={onBack}><i className="ti ti-arrow-left" />Back</Btn>
        <Btn primary onClick={onNext}>Export plan <i className="ti ti-arrow-right" /></Btn>
      </div>
    </div>
  )
}
