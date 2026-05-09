import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { Card, SectionTitle, Btn, FormGroup, Select, Tag, Empty } from '../components/UI.jsx'
import s from './RateCardPage.module.css'

const IMPORT_FIELDS = {
  name:            'Show name *',
  adNetwork:       'Ad network',
  category:        'Category / genre',
  listenersPerEp:  'Listeners per episode',
  listenersMonthly:'Monthly listeners',
  releaseFrequency:'Release frequency',
  cpm:             'CPM ($)',
  sponsorshipTypes:'Sponsorship types',
  hostLocation:    'Host location',
  demographics:    'Demographics',
  url:             'Show URL',
  description:     'Description / other',
}

const EMPTY_POD = {
  id: null, name: '', adNetwork: '', category: '',
  listenersPerEp: 0, listenersMonthly: 0, releaseFrequency: '',
  cpm: 0, sponsorshipTypes: '', hostLocation: '',
  demographics: '', url: '', description: '',
}

function guessMapping(headers) {
  const h = headers.map(x => (x || '').toLowerCase())
  const find = (...terms) => headers[h.findIndex(x => terms.some(t => x.includes(t)))] || ''
  return {
    name:             find('name', 'show', 'podcast', 'title', 'program'),
    adNetwork:        find('network', 'ad network', 'agency', 'partner'),
    category:         find('categor', 'genre', 'topic', 'vertical', 'niche'),
    listenersPerEp:   find('per ep', 'per episode', 'episode download'),
    listenersMonthly: find('monthly', 'listener', 'download', 'audience', 'reach', 'traffic'),
    releaseFrequency: find('frequen', 'release', 'schedule', 'cadence'),
    cpm:              find('cpm', 'rate', 'cost', 'price'),
    sponsorshipTypes: find('sponsor', 'ad type', 'format', 'placement'),
    hostLocation:     find('location', 'host location', 'city', 'country'),
    demographics:     find('demo', 'gender', 'age', 'audience profile'),
    url:              find('url', 'link', 'website', 'http'),
    description:      find('desc', 'about', 'summary', 'overview', 'notes', 'other'),
  }
}

function parseNum(v) {
  if (v == null || v === '') return 0
  return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0
}

function ShowDrawer({ show, onSave, onCancel }) {
  const [row, setRow] = useState({ ...show })
  const upd = (k, v) => setRow(r => ({ ...r, [k]: v }))
  return (
    <div className={s.drawerOverlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className={s.drawer}>
        <div className={s.drawerHeader}>
          <h3 className={s.drawerTitle}>{show.name ? `Edit: ${show.name}` : 'Add show'}</h3>
          <button className={s.drawerClose} onClick={onCancel}><i className="ti ti-x" /></button>
        </div>
        <div className={s.drawerBody}>
          <div className={s.drawerSection}>
            <p className={s.drawerSectionLabel}>Basic info</p>
            <FormGroup label="Show name *">
              <input className={s.drawerInput} value={row.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. The Daily" />
            </FormGroup>
            <div className={s.drawerRow}>
              <FormGroup label="Category / genre">
                <input className={s.drawerInput} value={row.category} onChange={e => upd('category', e.target.value)} placeholder="e.g. True Crime, Business" />
              </FormGroup>
              <FormGroup label="Ad network">
                <input className={s.drawerInput} value={row.adNetwork} onChange={e => upd('adNetwork', e.target.value)} placeholder="e.g. Spotify, Acast, Independent" />
              </FormGroup>
            </div>
            <FormGroup label="Show URL">
              <input className={s.drawerInput} type="url" value={row.url} onChange={e => upd('url', e.target.value)} placeholder="https://…" />
            </FormGroup>
          </div>

          <div className={s.drawerSection}>
            <p className={s.drawerSectionLabel}>Audience & reach</p>
            <div className={s.drawerRow}>
              <FormGroup label="Listeners per episode">
                <input className={s.drawerInput} type="number" value={row.listenersPerEp || ''} onChange={e => upd('listenersPerEp', e.target.value)} placeholder="0" />
              </FormGroup>
              <FormGroup label="Monthly listeners">
                <input className={s.drawerInput} type="number" value={row.listenersMonthly || ''} onChange={e => upd('listenersMonthly', e.target.value)} placeholder="0" />
              </FormGroup>
            </div>
            <FormGroup label="Listener demographics (gender split, age range, interests…)">
              <textarea className={s.drawerTextarea} rows={2} value={row.demographics}
                onChange={e => upd('demographics', e.target.value)}
                placeholder="e.g. 60% female, 25–44, urban professionals, interested in wellness and finance" />
            </FormGroup>
            <FormGroup label="Host location">
              <input className={s.drawerInput} value={row.hostLocation} onChange={e => upd('hostLocation', e.target.value)} placeholder="e.g. New York, USA" />
            </FormGroup>
          </div>

          <div className={s.drawerSection}>
            <p className={s.drawerSectionLabel}>Pricing & sponsorship</p>
            <div className={s.drawerRow}>
              <FormGroup label="CPM rate ($)">
                <input className={s.drawerInput} type="number" step="0.01" value={row.cpm || ''} onChange={e => upd('cpm', e.target.value)} placeholder="0" />
              </FormGroup>
              <FormGroup label="Release frequency">
                <select className={s.drawerInput} value={row.releaseFrequency} onChange={e => upd('releaseFrequency', e.target.value)}>
                  <option value="">Select…</option>
                  {['Daily','Weekdays','Multiple per week','Weekly','Bi-weekly','Monthly','Irregular'].map(f => <option key={f}>{f}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label="Sponsorship types available">
              <input className={s.drawerInput} value={row.sponsorshipTypes} onChange={e => upd('sponsorshipTypes', e.target.value)}
                placeholder="e.g. 30s pre-roll, 60s mid-roll host read, branded episode" />
            </FormGroup>
          </div>

          <div className={s.drawerSection}>
            <p className={s.drawerSectionLabel}>Additional notes</p>
            <FormGroup label="Other important info (anything that doesn't fit above)">
              <textarea className={s.drawerTextarea} rows={3} value={row.description}
                onChange={e => upd('description', e.target.value)}
                placeholder="e.g. Strong community engagement, waitlist for Q3, exclusive categories, past brand partnerships…" />
            </FormGroup>
          </div>
        </div>
        <div className={s.drawerFooter}>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn primary onClick={() => onSave({ ...row, listenersPerEp: parseNum(row.listenersPerEp), listenersMonthly: parseNum(row.listenersMonthly), cpm: parseNum(row.cpm) })}>
            <i className="ti ti-check" /> Save show
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default function RateCardPage({ podcasts, setPodcasts, onNext }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const [mapping, setMapping] = useState(null)
  const [editShow, setEditShow] = useState(null)
  const fileRef = useRef()

  async function handleFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      setStatus({ type: 'loading', msg: `Parsing ${file.name}…` })
      try {
        if (ext === 'csv') await handleCSV(file)
        else if (ext === 'xlsx' || ext === 'xls') await handleXLSX(file)
        else if (ext === 'pdf') await handlePDF(file)
        else setStatus({ type: 'error', msg: `Unsupported file type: .${ext}` })
      } catch (e) {
        setStatus({ type: 'error', msg: e.message })
      }
    }
  }

  function handleCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: r => {
          if (!r.data.length) return reject(new Error('CSV appears empty'))
          const headers = Object.keys(r.data[0])
          setMapping({ headers, rows: r.data, map: guessMapping(headers), filename: file.name, adNetwork: '' })
          setStatus(null); resolve()
        },
        error: e => reject(e)
      })
    })
  }

  async function handleXLSX(file) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (!rows.length) throw new Error('Spreadsheet appears empty')
    const headers = Object.keys(rows[0])
    setMapping({ headers, rows, map: guessMapping(headers), filename: file.name, adNetwork: '' })
    setStatus(null)
  }

  async function handlePDF(file) {
    setStatus({ type: 'loading', msg: `Extracting data from PDF with AI… (15–30s)` })
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-file', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (data.type === 'pdf_extracted') {
      const headers = Object.keys(data.rows[0] || {})
      setMapping({ headers, rows: data.rows, map: guessMapping(headers), filename: file.name, adNetwork: '', pdfPrefilled: true })
      setStatus(null)
    }
  }

  function applyMapping() {
    const { rows, map, adNetwork, pdfPrefilled } = mapping
    const g = (r, key) => pdfPrefilled ? (r[key] || '') : (r[map[key]] || '')
    const enriched = rows.map((r, i) => ({
      ...EMPTY_POD,
      id: Date.now() + i,
      name:             g(r, 'name'),
      adNetwork:        adNetwork || g(r, 'adNetwork'),
      category:         g(r, 'category'),
      listenersPerEp:   parseNum(pdfPrefilled ? r.listeners_per_ep : r[map.listenersPerEp]),
      listenersMonthly: parseNum(pdfPrefilled ? r.listeners : r[map.listenersMonthly]),
      releaseFrequency: g(r, 'releaseFrequency') || (pdfPrefilled ? r.release_frequency || '' : ''),
      cpm:              parseNum(pdfPrefilled ? r.cpm : r[map.cpm]),
      sponsorshipTypes: g(r, 'sponsorshipTypes') || (pdfPrefilled ? r.sponsorship_types || '' : ''),
      hostLocation:     g(r, 'hostLocation') || (pdfPrefilled ? r.host_location || '' : ''),
      demographics:     g(r, 'demographics'),
      url:              g(r, 'url'),
      description:      g(r, 'description'),
    })).filter(p => p.name || p.cpm)
    setPodcasts(prev => [...prev, ...enriched])
    setStatus({ type: 'success', msg: `Imported ${enriched.length} shows from ${mapping.filename}${adNetwork ? ` · ${adNetwork}` : ''}` })
    setMapping(null)
    setTimeout(() => setStatus(null), 5000)
  }

  function openAdd() { setEditShow({ show: { ...EMPTY_POD, id: Date.now() }, idx: -1 }) }
  function openEdit(i) { setEditShow({ show: { ...podcasts[i] }, idx: i }) }
  function handleSave(saved) {
    if (editShow.idx === -1) setPodcasts(prev => [...prev, { ...saved, id: Date.now() }])
    else setPodcasts(prev => prev.map((p, i) => i === editShow.idx ? saved : p))
    setEditShow(null)
  }
  function deletePod(id) { setPodcasts(p => p.filter(x => x.id !== id)) }
  const onDrop = useCallback(e => { e.preventDefault(); setDragging(false); handleFiles([...e.dataTransfer.files]) }, [])

  return (
    <div className="fade-in">
      <Card>
        <SectionTitle>Rate card library — {podcasts.length} shows loaded</SectionTitle>
        <div
          className={`${s.dropZone} ${dragging ? s.dragging : ''}`}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" multiple
            style={{ display: 'none' }} onChange={e => handleFiles([...e.target.files])} />
          <i className="ti ti-upload" aria-hidden="true" />
          <p>Drop files here or click to upload</p>
          <small>CSV, XLS, XLSX, PDF — upload multiple files from different ad networks</small>
        </div>
        {status && (
          <div className={`${s.statusBanner} ${s[status.type]}`}>
            {status.type === 'loading' && <i className="ti ti-loader spin" />}
            {status.type === 'success' && <i className="ti ti-check" />}
            {status.type === 'error' && <i className="ti ti-alert-circle" />}
            {status.msg}
          </div>
        )}
      </Card>

      {mapping && (
        <Card accent>
          <SectionTitle>Map columns — "{mapping.filename}" · {mapping.rows.length} rows</SectionTitle>
          <p className={s.mappingHint}>Tag the ad network these shows belong to, then match column headers to planner fields.</p>
          <div className={s.networkInput}>
            <i className="ti ti-building" />
            <input
              className={s.networkField}
              value={mapping.adNetwork}
              onChange={e => setMapping(m => ({ ...m, adNetwork: e.target.value }))}
              placeholder="Ad network name (e.g. Spotify, Acast, Wondery) — leave blank if independent"
            />
          </div>
          <div className={s.mappingGrid}>
            {Object.entries(IMPORT_FIELDS).map(([field, label]) => (
              <FormGroup key={field} label={label}>
                <Select
                  value={mapping.map[field] || ''}
                  onChange={e => setMapping(m => ({ ...m, map: { ...m.map, [field]: e.target.value } }))}
                >
                  <option value="">— skip —</option>
                  {mapping.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </FormGroup>
            ))}
          </div>
          <div className={s.mappingActions}>
            <Btn primary onClick={applyMapping}><i className="ti ti-check" /> Import {mapping.rows.length} rows</Btn>
            <Btn onClick={() => setMapping(null)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {podcasts.length > 0 ? (
        <Card>
          <div className={s.tableHeader}>
            <SectionTitle style={{ margin: 0 }}>{podcasts.length} shows in library</SectionTitle>
            <div className={s.tableActions}>
              <Btn sm onClick={openAdd}><i className="ti ti-plus" />Add manually</Btn>
              <Btn sm danger onClick={() => { if (confirm('Remove all shows?')) setPodcasts([]) }}>
                <i className="ti ti-trash" />Clear all
              </Btn>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Show name</th><th>Network</th><th>Category</th>
                  <th>Ep. listeners</th><th>Mo. listeners</th><th>Frequency</th>
                  <th>CPM</th><th>Formats</th><th>Location</th><th>Demographics</th><th>Link</th><th />
                </tr>
              </thead>
              <tbody>
                {podcasts.map((p, i) => (
                  <tr key={p.id}>
                    <td className={s.bold}>{p.name || <span className={s.muted}>—</span>}</td>
                    <td>{p.adNetwork ? <Tag color="amber">{p.adNetwork}</Tag> : <span className={s.muted}>Indie</span>}</td>
                    <td>{p.category ? <Tag color="blue">{p.category}</Tag> : <span className={s.muted}>—</span>}</td>
                    <td>{p.listenersPerEp ? p.listenersPerEp.toLocaleString() : <span className={s.muted}>—</span>}</td>
                    <td>{p.listenersMonthly ? p.listenersMonthly.toLocaleString() : <span className={s.muted}>—</span>}</td>
                    <td>{p.releaseFrequency || <span className={s.muted}>—</span>}</td>
                    <td>{p.cpm ? '$' + p.cpm.toFixed(2) : <span className={s.muted}>—</span>}</td>
                    <td className={s.descCell}>{p.sponsorshipTypes || <span className={s.muted}>—</span>}</td>
                    <td>{p.hostLocation || <span className={s.muted}>—</span>}</td>
                    <td className={s.descCell}>{p.demographics || <span className={s.muted}>—</span>}</td>
                    <td>{p.url
                      ? <a href={p.url} target="_blank" rel="noopener noreferrer" className={s.urlLink}><i className="ti ti-external-link" /></a>
                      : <span className={s.muted}>—</span>}
                    </td>
                    <td>
                      <div className={s.rowActions}>
                        <Btn sm onClick={() => openEdit(i)}><i className="ti ti-edit" /></Btn>
                        <Btn sm danger onClick={() => deletePod(p.id)}><i className="ti ti-trash" /></Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.pageActions}>
            <Btn primary onClick={onNext}>Continue to brief <i className="ti ti-arrow-right" /></Btn>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty icon="ti-microphone" title="No shows loaded yet" sub="Upload your rate card files above, or add shows manually.">
            <div style={{ marginTop: 14 }}>
              <Btn sm onClick={openAdd}><i className="ti ti-plus" />Add a show manually</Btn>
            </div>
          </Empty>
        </Card>
      )}

      {editShow && <ShowDrawer show={editShow.show} onSave={handleSave} onCancel={() => setEditShow(null)} />}
    </div>
  )
}
