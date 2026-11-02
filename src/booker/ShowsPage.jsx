import { useState, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Card, SectionTitle, Btn, FormGroup, Input, Select, Textarea, Row, Col, Empty } from '../components/UI.jsx'
import { bapi, csvEsc, download, money } from './api.js'
import s from './booker.module.css'

export const FIELDS = {
  name: 'Podcast name', category: 'Category', listenersPerEp: 'Listeners per episode', listenersMonthly: 'Monthly listeners',
  location: 'Location', showBio: 'Show bio', notes: 'Notes', url: 'Link / URL', interviewCost: 'Interview booking cost (USD)', hostEmail: 'Host email'
}
const GUESS = {
  name: /(show|podcast).*(name|title)|^(name|show|podcast|title)$/i,
  hostEmail: /e-?mail/i,
  listenersPerEp: /(per ?ep|episode).*(listen|download)|(listen|download).*(per ?ep|episode)|avg/i,
  listenersMonthly: /month/i,
  interviewCost: /cost|price|rate|fee/i,
  url: /url|link|website|site/i,
  location: /location|city|country|based|region/i,
  showBio: /bio|description|about|summary/i,
  category: /categor|genre|topic|niche|vertical/i,
  notes: /note|comment|other|remark/i,
}
function autoMap(headers) {
  const map = {}, used = new Set()
  for (const f of Object.keys(GUESS)) {
    const h = headers.find(h => !used.has(h) && GUESS[f].test(String(h)))
    if (h) { map[f] = h; used.add(h) }
  }
  return map
}
const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/); const n = m ? parseFloat(m[0]) : 0; return n > 99999999 ? 0 : n }
const STALE_DAYS = 90
const daysSince = d => d ? Math.floor((Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 86400000) : null
function activity(p) {
  const st = p.activityStatus
  if (!st) return { key: 'unchecked', label: 'Not checked', cls: '' }
  const d = daysSince(p.lastEpisode)
  if (d == null) return { key: 'unknown', label: st === 'notfound' ? 'Feed not found' : st === 'error' ? 'Check failed' : 'No date found', cls: '' }
  const low = st === 'lowmatch' ? ' (verify match)' : ''
  if (d > STALE_DAYS) return { key: 'stale', label: `Inactive ${d}d${low}`, cls: 'stale' }
  return { key: 'active', label: `${p.lastEpisode}${low}`, cls: 'active' }
}
const EMPTY = { id: '', name: '', category: '', listenersPerEp: '', listenersMonthly: '', location: '', showBio: '', notes: '', url: '', interviewCost: '', hostEmail: '' }

export default function ShowsPage({ shows, setShows, dbReady, onNext }) {
  const [mapping, setMapping] = useState(null)
  const [status, setStatus] = useState(null)
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [checking, setChecking] = useState(null)
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setStatus({ type: 'loading', msg: `Reading ${file.name}…` })
    try {
      let rows = []
      if (/\.csv$/i.test(file.name)) {
        rows = await new Promise((res, rej) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => res(r.data), error: rej }))
      } else {
        const wb = XLSX.read(await file.arrayBuffer())
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      }
      if (!rows.length) throw new Error('No rows found')
      const headers = Object.keys(rows[0])
      setMapping({ filename: file.name, rows, headers, map: autoMap(headers) })
      setStatus(null)
    } catch (e) { setStatus({ type: 'error', msg: 'Could not read file: ' + e.message }) }
  }

  async function doImport() {
    const m = mapping.map
    if (!m.name) { setStatus({ type: 'error', msg: 'Choose which column holds the podcast name.' }); return }
    const base = Date.now()
    const imported = mapping.rows.map((r, i) => {
      const g = f => (m[f] ? String(r[m[f]] ?? '').trim() : '')
      return {
        id: `${base}-${i}`, name: g('name'), category: g('category'),
        listenersPerEp: num(g('listenersPerEp')), listenersMonthly: num(g('listenersMonthly')),
        location: g('location'), showBio: g('showBio'), notes: g('notes'), url: g('url'),
        interviewCost: num(g('interviewCost')), hostEmail: g('hostEmail')
      }
    }).filter(x => x.name)
    // Skip shows already in the library (same name)
    const have = new Set(shows.map(x => x.name.toLowerCase()))
    const fresh = imported.filter(x => !have.has(x.name.toLowerCase()))
    setShows(prev => [...prev, ...fresh])
    setMapping(null)
    setStatus({ type: 'loading', msg: `Saving ${fresh.length} shows…` })
    try {
      if (dbReady && fresh.length) await bapi.bulkSave(fresh)
      setStatus({ type: 'success', msg: `Imported ${fresh.length} shows${imported.length - fresh.length ? ` (${imported.length - fresh.length} duplicates skipped)` : ''}` })
    } catch (e) { setStatus({ type: 'error', msg: 'Imported, but saving to database failed: ' + e.message }) }
    setTimeout(() => setStatus(null), 6000)
  }

  function saveShow(show) {
    const final = { ...show, id: show.id || String(Date.now()), listenersPerEp: num(show.listenersPerEp), listenersMonthly: num(show.listenersMonthly), interviewCost: num(show.interviewCost) }
    setShows(prev => prev.some(p => p.id === final.id) ? prev.map(p => p.id === final.id ? final : p) : [...prev, final])
    setEdit(null)
    if (dbReady) bapi.saveShow(final).catch(console.error)
  }
  function del(id) { setShows(p => p.filter(x => x.id !== id)); if (dbReady) bapi.deleteShow(id).catch(console.error) }

  function exportCSV() {
    const keys = Object.keys(FIELDS)
    const csv = [keys.map(k => csvEsc(FIELDS[k])).join(','), ...shows.map(p => keys.map(k => csvEsc(p[k])).join(','))].join('\n')
    download(`interview_library_${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  async function checkAll() {
    if (!dbReady) { setStatus({ type: 'error', msg: 'Activity check needs the database connection.' }); return }
    const ids = shows.map(x => x.id), B = 8
    let done = 0, failed = 0
    setChecking({ done: 0, total: ids.length })
    for (let i = 0; i < ids.length; i += B) {
      try {
        const { results } = await bapi.checkActivity(ids.slice(i, i + B))
        const map = Object.fromEntries(results.map(r => [r.id, r]))
        setShows(prev => prev.map(x => map[x.id] ? { ...x, ...map[x.id] } : x))
      } catch (e) { failed += ids.slice(i, i + B).length }
      done = Math.min(i + B, ids.length)
      setChecking({ done, total: ids.length })
    }
    setChecking(null)
    setStatus({ type: failed ? 'error' : 'success', msg: failed ? `Checked ${ids.length - failed} shows; ${failed} could not be checked — run it again.` : `Checked ${ids.length} shows.` })
    setTimeout(() => setStatus(null), 8000)
  }
  const staleShows = shows.filter(p => activity(p).key === 'stale')
  function removeStale() {
    if (!staleShows.length || !confirm(`Remove ${staleShows.length} shows with no episode in ${STALE_DAYS}+ days? This cannot be undone.`)) return
    const gone = new Set(staleShows.map(x => x.id))
    setShows(prev => prev.filter(x => !gone.has(x.id)))
    if (dbReady) staleShows.forEach(x => bapi.deleteShow(x.id).catch(console.error))
  }

  const shown = shows.filter(p => (!q || [p.name, p.category, p.location].join(' ').toLowerCase().includes(q.toLowerCase())) && (filter === 'all' || activity(p).key === filter))

  return (
    <div className="fade-in">
      <Card>
        <SectionTitle>Interview library — {shows.length} shows</SectionTitle>
        <div className={s.drop} onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
          <i className="ti ti-upload" />
          <p>Drop a CSV or Excel file here, or click to upload</p>
          <small>Columns are matched automatically, and you can adjust them before importing</small>
        </div>
        {status && <div className={`${s.status} ${s[status.type]}`}>{status.msg}</div>}
      </Card>

      {mapping && (
        <Card accent>
          <SectionTitle>Match columns — "{mapping.filename}" · {mapping.rows.length} rows</SectionTitle>
          <div className={s.mapGrid}>
            {Object.entries(FIELDS).map(([f, label]) => (
              <FormGroup key={f} label={label + (f === 'name' ? ' *' : '')}>
                <Select value={mapping.map[f] || ''} onChange={e => setMapping(m => ({ ...m, map: { ...m.map, [f]: e.target.value } }))}>
                  <option value="">— skip —</option>
                  {mapping.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </FormGroup>
            ))}
          </div>
          <div className={s.actions}>
            <Btn primary onClick={doImport}>Import {mapping.rows.length} rows</Btn>
            <Btn onClick={() => setMapping(null)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <Card>
        <div className={s.tableHead}>
          <SectionTitle>{shows.length} shows</SectionTitle>
          <div className={s.tools}>
            <input className={s.search} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
            <Btn sm onClick={() => setEdit({ ...EMPTY })}><i className="ti ti-plus" />Add show</Btn>
            {shows.length > 0 && <select className={s.search} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All shows</option><option value="stale">Inactive {STALE_DAYS}+ days</option><option value="active">Active</option><option value="unknown">No date / not found</option><option value="unchecked">Not checked</option>
            </select>}
            {shows.length > 0 && <Btn sm disabled={!!checking} onClick={checkAll}><i className="ti ti-activity" />{checking ? `Checking ${checking.done}/${checking.total}…` : 'Check activity'}</Btn>}
            {staleShows.length > 0 && <Btn sm danger onClick={removeStale}><i className="ti ti-trash" />Remove inactive ({staleShows.length})</Btn>}
            {shows.length > 0 && <Btn sm onClick={exportCSV}><i className="ti ti-download" />Export CSV</Btn>}
            {shows.length > 0 && <Btn sm danger onClick={() => { if (confirm('Remove all shows from the interview library?')) { setShows([]); if (dbReady) bapi.deleteAllShows().catch(console.error) } }}><i className="ti ti-trash" />Clear all</Btn>}
          </div>
        </div>
        {shows.length === 0 ? <Empty icon="ti-microphone-2" title="No shows yet" sub="Upload a file or add a show manually." /> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>Podcast</th><th>Category</th><th>Ep. listeners</th><th>Monthly</th><th>Location</th><th>Booking cost</th><th>Last episode</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {shown.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong>{p.url && <> <a href={p.url} target="_blank" rel="noreferrer"><i className="ti ti-external-link" /></a></>}</td>
                    <td>{p.category}</td>
                    <td>{p.listenersPerEp ? p.listenersPerEp.toLocaleString() : '—'}</td>
                    <td>{p.listenersMonthly ? p.listenersMonthly.toLocaleString() : '—'}</td>
                    <td>{p.location}</td>
                    <td>{p.interviewCost ? money(p.interviewCost) : '—'}</td>
                    <td title={p.feedMatch ? 'Matched feed: ' + p.feedMatch : ''}><span className={`${s.act} ${activity(p).cls ? s['act_' + activity(p).cls] : ''}`}>{activity(p).label}</span></td>
                    <td className={s.email}>{p.hostEmail}</td>
                    <td className={s.rowBtns}>
                      <button onClick={() => setEdit({ ...p })} title="Edit"><i className="ti ti-pencil" /></button>
                      <button onClick={() => del(p.id)} title="Delete"><i className="ti ti-x" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className={s.actions}><span /><Btn primary disabled={!shows.length} onClick={onNext}>Next: Brand brief <i className="ti ti-arrow-right" /></Btn></div>

      {edit && (
        <div className={s.overlay} onClick={() => setEdit(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <SectionTitle>{edit.id ? 'Edit show' : 'Add show'}</SectionTitle>
            <FormGroup label="Podcast name *"><Input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></FormGroup>
            <Row>
              <Col><FormGroup label="Category"><Input value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} /></FormGroup></Col>
              <Col><FormGroup label="Location"><Input value={edit.location} onChange={e => setEdit({ ...edit, location: e.target.value })} /></FormGroup></Col>
            </Row>
            <Row>
              <Col><FormGroup label="Listeners per episode"><Input type="number" value={edit.listenersPerEp} onChange={e => setEdit({ ...edit, listenersPerEp: e.target.value })} /></FormGroup></Col>
              <Col><FormGroup label="Monthly listeners"><Input type="number" value={edit.listenersMonthly} onChange={e => setEdit({ ...edit, listenersMonthly: e.target.value })} /></FormGroup></Col>
            </Row>
            <Row>
              <Col><FormGroup label="Interview booking cost (USD)"><Input type="number" value={edit.interviewCost} onChange={e => setEdit({ ...edit, interviewCost: e.target.value })} /></FormGroup></Col>
              <Col><FormGroup label="Host email"><Input type="email" value={edit.hostEmail} onChange={e => setEdit({ ...edit, hostEmail: e.target.value })} /></FormGroup></Col>
            </Row>
            <FormGroup label="Link / URL"><Input value={edit.url} onChange={e => setEdit({ ...edit, url: e.target.value })} /></FormGroup>
            <FormGroup label="Show bio"><Textarea rows={3} value={edit.showBio} onChange={e => setEdit({ ...edit, showBio: e.target.value })} /></FormGroup>
            <FormGroup label="Notes"><Textarea rows={2} value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></FormGroup>
            <div className={s.actions}><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn primary disabled={!edit.name} onClick={() => saveShow(edit)}>Save show</Btn></div>
          </div>
        </div>
      )}
    </div>
  )
}
