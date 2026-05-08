import { useState } from 'react'
import { Card, SectionTitle, Btn, Metrics, MetricCard, Empty } from '../components/UI.jsx'
import s from './ExportPage.module.css'

export default function ExportPage({ plan, brief, onBack }) {
  const [msg, setMsg] = useState('')

  if (!plan) return (
    <Card>
      <Empty icon="ti-file-off" title="No plan to export" sub="Please generate a media plan first.">
        <Btn style={{ marginTop: 14 }} onClick={onBack}><i className="ti ti-arrow-left" />Go back</Btn>
      </Empty>
    </Card>
  )

  const totalAlloc = plan.selections.reduce((a, s) => a + s.allocatedBudget, 0)
  const totalImp = plan.selections.reduce((a, s) => a + s.impressions, 0)
  const effCPM = totalImp > 0 ? (totalAlloc / (totalImp / 1000)) : 0

  function exportCSV() {
    const headers = ['Show', 'Category', 'Monthly Listeners', 'CPM ($)', 'Ad Format', 'Spots/Week', 'Allocated Budget ($)', 'Est. Impressions', 'Why Selected']
    const rows = plan.selections.map(s => [
      s.podcastName, s.podcastCategory || '', s.listeners || '', s.cpm || '',
      s.adFormat, s.spotsPerWeek, s.allocatedBudget, s.impressions, s.reason
    ])
    const totals = ['TOTAL', '', '', '', '', '',
      plan.selections.reduce((a, s) => a + s.allocatedBudget, 0),
      plan.selections.reduce((a, s) => a + s.impressions, 0), ''
    ]
    const csv = [headers, ...rows, [], totals]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    download(csv, `${slug(brief.brandName)}_media_plan.csv`, 'text/csv')
  }

  function exportHTML() {
    const COLORS = ['#378add', '#639922', '#d85a30', '#d4537e', '#ba7517', '#533ab7', '#1d9e75', '#888780']
    const bars = plan.selections.map((s, i) => {
      const pct = totalAlloc > 0 ? Math.round((s.allocatedBudget / totalAlloc) * 100) : 0
      return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:160px;font-size:12px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">${s.podcastName}</div>
        <div style="flex:1;height:22px;background:#f0eeea;border-radius:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${COLORS[i % COLORS.length]};display:flex;align-items:center;padding:0 8px;min-width:2px">
            ${pct > 12 ? `<span style="color:#fff;font-size:11px;font-weight:600">$${(s.allocatedBudget / 1000).toFixed(1)}k</span>` : ''}
          </div>
        </div>
        <div style="width:55px;font-size:12px;color:#555">$${(s.allocatedBudget / 1000).toFixed(1)}k</div>
      </div>`
    }).join('')

    const tableRows = plan.selections.map(s => `
      <tr>
        <td style="font-weight:500">${s.podcastName}</td>
        <td>${s.podcastCategory || '—'}</td>
        <td>${s.listeners ? s.listeners.toLocaleString() : '—'}</td>
        <td>$${s.cpm ? s.cpm.toFixed(2) : '—'}</td>
        <td>$${s.allocatedBudget.toLocaleString()}</td>
        <td>${s.impressions.toLocaleString()}</td>
        <td>${s.adFormat}</td>
        <td style="font-size:12px;color:#666">${s.reason}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Podcast Media Plan — ${brief.brandName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 48px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #777; margin-bottom: 36px; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #999; margin: 28px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 4px; }
  .metric { background: #f7f5f0; border-radius: 8px; padding: 14px 16px; }
  .metric-label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .metric-val { font-size: 22px; font-weight: 700; }
  .rationale { background: #f7f5f0; border-radius: 8px; padding: 16px 20px; font-size: 13px; line-height: 1.8; color: #444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th { padding: 9px 12px; background: #f7f5f0; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; border-bottom: 1px solid #eee; }
  td { padding: 9px 12px; border-bottom: 1px solid #f0eeea; vertical-align: top; }
  .footer { margin-top: 48px; font-size: 11px; color: #bbb; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
<h1>Podcast Media Plan</h1>
<p class="meta">${brief.brandName} · ${brief.category || 'Brand'} · $${parseFloat(brief.budget).toLocaleString()} budget · ${brief.flightWeeks} weeks · Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

<div class="metrics">
  <div class="metric"><div class="metric-label">Total budget</div><div class="metric-val">$${parseFloat(brief.budget).toLocaleString()}</div></div>
  <div class="metric"><div class="metric-label">Allocated</div><div class="metric-val">$${Math.round(totalAlloc).toLocaleString()}</div></div>
  <div class="metric"><div class="metric-label">Est. impressions</div><div class="metric-val">${(totalImp / 1000).toFixed(0)}k</div></div>
  <div class="metric"><div class="metric-label">Shows selected</div><div class="metric-val">${plan.selections.length}</div></div>
  <div class="metric"><div class="metric-label">Eff. CPM</div><div class="metric-val">$${effCPM.toFixed(2)}</div></div>
</div>

<h2>Strategy rationale</h2>
<div class="rationale">${plan.rationale}</div>

<h2>Budget allocation</h2>
<div style="margin: 8px 0 4px">${bars}</div>

<h2>Selected shows</h2>
<table>
  <thead><tr>
    <th>Show</th><th>Category</th><th>Listeners</th><th>CPM</th>
    <th>Budget</th><th>Impressions</th><th>Format</th><th>Rationale</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot>
    <tr style="font-weight:700;background:#f7f5f0">
      <td>Total</td><td></td><td></td><td></td>
      <td>$${Math.round(totalAlloc).toLocaleString()}</td>
      <td>${totalImp.toLocaleString()}</td>
      <td></td><td></td>
    </tr>
  </tfoot>
</table>

<div class="footer">Generated by Podcast Media Planner · ${new Date().toLocaleDateString()}</div>
</body></html>`

    download(html, `${slug(brief.brandName)}_media_plan.html`, 'text/html')
    setMsg('Open the downloaded file in your browser, then use File → Print → Save as PDF for a polished PDF report.')
    setTimeout(() => setMsg(''), 10000)
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function slug(str) { return str.replace(/[^a-z0-9]/gi, '_').toLowerCase() }

  return (
    <div className="fade-in">
      <Metrics>
        <MetricCard label="Brand" value={brief.brandName} />
        <MetricCard label="Budget allocated" value={`$${Math.round(totalAlloc).toLocaleString()}`} />
        <MetricCard label="Est. impressions" value={`${(totalImp / 1000).toFixed(0)}k`} />
        <MetricCard label="Shows" value={plan.selections.length} />
        <MetricCard label="Eff. CPM" value={`$${effCPM.toFixed(2)}`} />
      </Metrics>

      <Card>
        <SectionTitle>Export your media plan</SectionTitle>
        <div className={s.exportGrid}>
          <div className={s.exportOption}>
            <div className={s.exportIcon} style={{ color: '#378add' }}>
              <i className="ti ti-table" />
            </div>
            <div className={s.exportInfo}>
              <h3>CSV spreadsheet</h3>
              <p>All show data, budgets, impressions and rationale. Import into Excel or Google Sheets for further editing.</p>
            </div>
            <Btn primary onClick={exportCSV}>
              <i className="ti ti-download" />Download CSV
            </Btn>
          </div>

          <div className={s.exportOption}>
            <div className={s.exportIcon} style={{ color: '#d85a30' }}>
              <i className="ti ti-file-description" />
            </div>
            <div className={s.exportInfo}>
              <h3>PDF media plan</h3>
              <p>Branded report with budget chart, strategy rationale, and full show table. Download as HTML then print to PDF.</p>
            </div>
            <Btn onClick={exportHTML} style={{ borderColor: 'rgba(216,90,48,0.4)', color: '#d85a30' }}>
              <i className="ti ti-download" />Download report
            </Btn>
          </div>
        </div>

        {msg && (
          <div className={s.hint}>
            <i className="ti ti-info-circle" />
            {msg}
          </div>
        )}
      </Card>

      <div className={s.actions}>
        <Btn onClick={onBack}><i className="ti ti-arrow-left" />Back to plan</Btn>
      </div>
    </div>
  )
}
