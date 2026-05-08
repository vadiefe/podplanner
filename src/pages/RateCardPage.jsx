import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { Card, SectionTitle, Btn, FormGroup, Select, Tag, Empty } from '../components/UI.jsx'
import s from './RateCardPage.module.css'

const FIELDS = {
  name: 'Show name *',
  listeners: 'Monthly listeners',
  cpm: 'CPM rate ($)',
  category: 'Category / genre',
  description: 'Description'
}

function guessMapping(headers) {
  const h = headers.map(x => (x || '').toLowerCase())
  const find = (...terms) => headers[h.findIndex(x => terms.some(t => x.includes(t)))] || ''
  return {
    name: find('name', 'show', 'podcast', 'title', 'program'),
    listeners: find('listener', 'download', 'audience', 'monthly', 'reach', 'traffic'),
    cpm: find('cpm', 'rate', 'cost', 'price'),
    category: find('categor', 'genre', 'topic', 'vertical', 'niche'),
    description: find('desc', 'about', 'summary', 'overview', 'notes')
  }
}

function parseNum(v) {
  if (v == null || v === '') return 0
  return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0
}

export default function RateCardPage({ podcasts, setPodcasts, onNext }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'loading'|'error'|'success', msg }
  const [mapping, setMapping] = useState(null) // { headers, rows, map }
  const [editIdx, setEditIdx] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const fileRef = useRef()

  async function handleFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase()
      setStatus({ type: 'loading', msg: `Parsing ${file.name}…` })

      try {
        if (ext === 'csv') {
          await handleCSV(file)
        } else if (ext === 'xlsx' || ext === 'xls') {
          await handleXLSX(file)
        } else if (ext === 'pdf') {
          await handlePDF(file)
        } else {
          setStatus({ type: 'error', msg: `Unsupported file type: .${ext}` })
        }
      } catch (e) {
        setStatus({ type: 'error', msg: e.message })
      }
    }
  }

  function handleCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => {
          if (!r.data.length) return reject(new Error('CSV appears empty'))
          const headers = Object.keys(r.data[0])
          setMapping({ headers, rows: r.data, map: guessMapping(headers), filename: file.name })
          setStatus(null)
          resolve()
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
    setMapping({ headers, rows, map: guessMapping(headers), filename: file.name })
    setStatus(null)
  }

  async function handlePDF(file) {
    setStatus({ type: 'loading', msg: `Extracting data from PDF with AI… (may take 15–30s)` })
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-file', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    if (data.type === 'pdf_extracted') {
      // Already mapped by the server
      const enriched = data.rows.map((r, i) => ({
        id: Date.now() + i,
        name: r.name || 'Unknown show',
        listeners: parseNum(r.listeners),
        cpm: parseNum(r.cpm),
        category: r.category || '',
        description: r.description || ''
      })).filter(p => p.name !== 'Unknown show' || p.cpm)
      setPodcasts(prev => [...prev, ...enriched])
      setStatus({ type: 'success', msg: `Extracted ${enriched.length} shows from PDF` })
      setTimeout(() => setStatus(null), 4000)
    }
  }

  function applyMapping() {
    const { rows, map } = mapping
    const enriched = rows.map((r, i) => ({
      id: Date.now() + i,
      name: r[map.name] || '',
      listeners: parseNum(r[map.listeners]),
      cpm: parseNum(r[map.cpm]),
      category: r[map.category] || '',
      description: r[map.description] || ''
    })).filter(p => p.name || p.cpm)
    setPodcasts(prev => [...prev, ...enriched])
    setStatus({ type: 'success', msg: `Imported ${enriched.length} shows from ${mapping.filename}` })
    setMapping(null)
    setTimeout(() => setStatus(null), 4000)
  }

  function addManual() {
    const newPod = { id: Date.now(), name: '', listeners: 0, cpm: 0, category: '', description: '' }
    setPodcasts(prev => [...prev, newPod])
    setEditIdx(podcasts.length)
    setEditRow({ ...newPod })
  }

  function startEdit(i) { setEditIdx(i); setEditRow({ ...podcasts[i] }) }
  function saveEdit() {
    setPodcasts(prev => prev.map((p, i) => i === editIdx
      ? { ...editRow, listeners: parseNum(editRow.listeners), cpm: parseNum(editRow.cpm) }
      : p))
    setEditIdx(null)
  }
  function deletePod(id) { setPodcasts(p => p.filter(x => x.id !== id)) }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    handleFiles([...e.dataTransfer.files])
  }, [])

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

      {/* Column mapping modal */}
      {mapping && (
        <Card accent>
          <SectionTitle>Map columns from "{mapping.filename}" — {mapping.rows.length} rows detected</SectionTitle>
          <p className={s.mappingHint}>Match your file's column headers to the planner fields.</p>
          <div className={s.mappingGrid}>
            {Object.entries(FIELDS).map(([field, label]) => (
              <FormGroup key={field} label={label}>
                <Select
                  value={mapping.map[field]}
                  onChange={e => setMapping(m => ({ ...m, map: { ...m.map, [field]: e.target.value } }))}
                >
                  <option value="">— skip —</option>
                  {mapping.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </FormGroup>
            ))}
          </div>
          <div className={s.mappingActions}>
            <Btn primary onClick={applyMapping}>
              <i className="ti ti-check" /> Import {mapping.rows.length} rows
            </Btn>
            <Btn onClick={() => setMapping(null)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {podcasts.length > 0 ? (
        <Card>
          <div className={s.tableHeader}>
            <SectionTitle style={{ margin: 0 }}>{podcasts.length} shows in library</SectionTitle>
            <div className={s.tableActions}>
              <Btn sm onClick={addManual}><i className="ti ti-plus" />Add manually</Btn>
              <Btn sm danger onClick={() => { if (confirm('Remove all shows?')) setPodcasts([]) }}>
                <i className="ti ti-trash" />Clear all
              </Btn>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Show name</th><th>Category</th><th>Monthly listeners</th>
                  <th>CPM ($)</th><th>Description</th><th />
                </tr>
              </thead>
              <tbody>
                {podcasts.map((p, i) => (
                  <tr key={p.id}>
                    {editIdx === i ? (
                      <>
                        <td><input className={s.cellInput} value={editRow.name} onChange={e => setEditRow(r => ({ ...r, name: e.target.value }))} placeholder="Show name" /></td>
                        <td><input className={s.cellInput} value={editRow.category} onChange={e => setEditRow(r => ({ ...r, category: e.target.value }))} placeholder="Category" /></td>
                        <td><input className={s.cellInput} type="number" value={editRow.listeners} onChange={e => setEditRow(r => ({ ...r, listeners: e.target.value }))} /></td>
                        <td><input className={s.cellInput} type="number" step="0.01" value={editRow.cpm} onChange={e => setEditRow(r => ({ ...r, cpm: e.target.value }))} /></td>
                        <td><input className={s.cellInput} value={editRow.description} onChange={e => setEditRow(r => ({ ...r, description: e.target.value }))} placeholder="Description" /></td>
                        <td><Btn sm primary onClick={saveEdit}><i className="ti ti-check" /></Btn></td>
                      </>
                    ) : (
                      <>
                        <td className={s.bold}>{p.name || <span className={s.muted}>—</span>}</td>
                        <td>{p.category ? <Tag color="blue">{p.category}</Tag> : <span className={s.muted}>—</span>}</td>
                        <td>{p.listeners ? p.listeners.toLocaleString() : <span className={s.muted}>—</span>}</td>
                        <td>{p.cpm ? '$' + p.cpm.toFixed(2) : <span className={s.muted}>—</span>}</td>
                        <td className={s.descCell}>{p.description || <span className={s.muted}>—</span>}</td>
                        <td>
                          <div className={s.rowActions}>
                            <Btn sm onClick={() => startEdit(i)}><i className="ti ti-edit" /></Btn>
                            <Btn sm danger onClick={() => deletePod(p.id)}><i className="ti ti-trash" /></Btn>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.pageActions}>
            <Btn primary onClick={onNext}>
              Continue to brief <i className="ti ti-arrow-right" />
            </Btn>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty icon="ti-microphone" title="No shows loaded yet" sub="Upload your rate card files above to get started.">
            <div style={{ marginTop: 14 }}>
              <Btn sm onClick={addManual}><i className="ti ti-plus" />Add a show manually</Btn>
            </div>
          </Empty>
        </Card>
      )}
    </div>
  )
}
