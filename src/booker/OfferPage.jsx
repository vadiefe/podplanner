import { useState } from 'react'
import { Card, SectionTitle, Btn, Metrics, MetricCard } from '../components/UI.jsx'
import { bapi, csvEsc, download, money } from './api.js'
import s from './booker.module.css'

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default function OfferPage({ brief, match, onBack }) {
  const [saved, setSaved] = useState('')
  const items = (match?.selections || []).filter(x => x.included)
  const total = items.reduce((a, x) => a + (x.price || 0), 0)
  const slug = (brief.brandName || 'offer').replace(/\W+/g, '_').toLowerCase()

  function clientCSV() {
    const h = ['Podcast', 'Category', 'Listeners per Episode', 'Format', 'Pitch Angle', 'Price (USD)']
    const rows = items.map(x => [x.podcastName, x.category, x.listenersPerEp || '', x.format, x.pitchAngle, x.price || 'Quote on request'])
    rows.push(['TOTAL', '', '', '', '', total])
    download(`${slug}_interview_offer.csv`, [h, ...rows].map(r => r.map(csvEsc).join(',')).join('\n'))
  }
  function internalCSV() {
    const h = ['Podcast', 'Host Email', 'Link', 'Category', 'Location', 'Listeners per Episode', 'Monthly Listeners', 'Format', 'Fit', 'Pitch Angle', 'Host Cost (internal)', 'Offer Price']
    const rows = items.map(x => [x.podcastName, x.hostEmail, x.url, x.category, x.location, x.listenersPerEp || '', x.listenersMonthly || '', x.format, x.fitScore, x.pitchAngle, x.hostCost || '', x.price || ''])
    download(`${slug}_INTERNAL_booking_sheet.csv`, [h, ...rows].map(r => r.map(csvEsc).join(',')).join('\n'))
  }
  function html() {
    const cards = items.map(x => `
      <div class="card"><div class="top"><div><h3>${esc(x.podcastName)}</h3><div class="meta">${esc(x.category)}${x.location ? ' · ' + esc(x.location) : ''}</div></div>
      <div class="price">${x.price ? money(x.price) : 'Quote on request'}</div></div>
      <p>${esc(x.reason)}</p><p class="pitch"><strong>Proposed angle:</strong> ${esc(x.pitchAngle)}</p>
      <div class="chips"><span>${esc(x.format)}</span>${x.listenersPerEp ? `<span>${x.listenersPerEp.toLocaleString()} listeners / episode</span>` : ''}${x.listenersMonthly ? `<span>${x.listenersMonthly.toLocaleString()} monthly listeners</span>` : ''}</div></div>`).join('')
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Podcast booking offer — ${esc(brief.brandName)}</title><style>
      body{font-family:-apple-system,Segoe UI,sans-serif;max-width:860px;margin:0 auto;padding:40px 28px;color:#111;background:#fff}
      h1{font-size:28px;font-weight:500;margin:0 0 4px}.sub{color:#666;margin-bottom:24px}
      .summary{background:#f5f4f0;border-radius:10px;padding:16px 18px;line-height:1.6;margin-bottom:22px}
      .tot{display:flex;gap:12px;margin-bottom:24px}.tot div{flex:1;background:#f5f4f0;border-radius:10px;padding:14px 16px}.tot b{display:block;font-size:22px;font-weight:500;margin-top:4px}.tot small{color:#666;font-size:12px}
      .card{border:1px solid #e3e1da;border-radius:10px;padding:16px 18px;margin-bottom:12px;page-break-inside:avoid}
      .top{display:flex;justify-content:space-between;gap:16px}.top h3{margin:0;font-size:17px;font-weight:500}.meta{color:#777;font-size:12px;margin-top:2px}
      .price{font-size:18px;font-weight:500;white-space:nowrap}.card p{font-size:14px;line-height:1.55;margin:10px 0 0;color:#333}.pitch{color:#111}
      .chips{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}.chips span{background:#eef3f8;color:#185fa5;font-size:11px;padding:3px 9px;border-radius:99px}
      @media print{body{padding:0}}</style></head><body>
      <h1>Podcast booking offer</h1><div class="sub">Prepared for ${esc(brief.brandName)}${brief.guestName ? ' · Guest: ' + esc(brief.guestName) : ''} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      ${match.summary ? `<div class="summary">${esc(match.summary)}</div>` : ''}
      <div class="tot"><div><small>Total offer</small><b>${money(total)}</b></div><div><small>Shows</small><b>${items.length}</b></div></div>
      ${cards}</body></html>`
    download(`${slug}_interview_offer.html`, doc, 'text/html;charset=utf-8')
  }
  async function saveOffer() {
    try { await bapi.saveOffer(brief, { summary: match.summary, selections: items, total }); setSaved('Saved to database') } catch (e) { setSaved('Save failed: ' + e.message) }
    setTimeout(() => setSaved(''), 3000)
  }

  return (
    <div className="fade-in">
      <Card>
        <SectionTitle>Offer for {brief.brandName}</SectionTitle>
        <Metrics><MetricCard label="Total offer" value={money(total)} /><MetricCard label="Shows" value={items.length} /></Metrics>
        {items.map(x => (
          <div key={x.id} className={s.offerRow}>
            <div><strong>{x.podcastName}</strong><div className={s.sub}>{x.format} · {x.pitchAngle}</div></div>
            <div>{x.price ? money(x.price) : 'Quote on request'}</div>
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle>Export</SectionTitle>
        <div className={s.exportRow}>
          <Btn primary onClick={html}><i className="ti ti-file-text" />Client offer (HTML → print as PDF)</Btn>
          <Btn onClick={clientCSV}><i className="ti ti-download" />Client offer (CSV)</Btn>
          <Btn onClick={internalCSV}><i className="ti ti-lock" />Internal booking sheet (CSV, with host emails)</Btn>
          <Btn onClick={saveOffer}><i className="ti ti-device-floppy" />Save offer</Btn>
          {saved && <span className={s.sub}>{saved}</span>}
        </div>
        <p className={s.hint}>The client files show only offer prices. Host emails and host costs appear only in the internal sheet.</p>
      </Card>
      <div className={s.actions}><Btn onClick={onBack}><i className="ti ti-arrow-left" />Back</Btn><span /></div>
    </div>
  )
}
