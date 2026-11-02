import { useState } from 'react'
import { Card, SectionTitle, Btn, FormGroup, Input, Select, Textarea, Row, Col, Tag } from '../components/UI.jsx'
import { bapi, money } from './api.js'
import s from './booker.module.css'

export const EMPTY_BRIEF = {
  id: '', brandName: '', category: '', brandDesc: '', guestName: '', guestBio: '', topics: '', targetAudience: '',
  goal: 'awareness', format: 'either', numBookings: '6', budget: '', locationPref: '', serviceFee: '0', notes: ''
}
const GOALS = { awareness: 'Brand awareness', thought: 'Thought leadership', leads: 'Lead generation', launch: 'Product / book launch', hiring: 'Recruiting / employer brand' }
const FORMATS = { either: 'Interview or sponsored episode', interview: 'Guest interview', sponsored: 'Sponsored episode' }

export default function BriefPage({ brief, setBrief, briefs, setBriefs, dbReady, onNext, onBack }) {
  const [saveState, setSaveState] = useState(null)
  const upd = (k, v) => setBrief(b => ({ ...b, [k]: v }))
  const valid = brief.brandName && brief.brandDesc && brief.topics

  async function save() {
    if (!brief.brandName) return
    setSaveState('saving')
    try {
      const id = brief.id || String(Date.now())
      const toSave = { ...brief, id }
      if (dbReady) await bapi.saveBrief(toSave)
      setBriefs(p => p.some(b => b.id === id) ? p.map(b => b.id === id ? { ...toSave, updatedAt: new Date().toISOString() } : b) : [{ ...toSave, updatedAt: new Date().toISOString() }, ...p])
      setBrief(toSave)
      setSaveState('saved')
    } catch { setSaveState('error') }
    setTimeout(() => setSaveState(null), 2500)
  }
  async function del(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this brief?')) return
    try { if (dbReady) await bapi.deleteBrief(id) } catch { return alert('Failed to delete') }
    setBriefs(p => p.filter(b => b.id !== id))
    if (brief.id === id) setBrief({ ...EMPTY_BRIEF })
  }

  return (
    <div className="fade-in">
      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.sideHead}><span>Saved briefs</span><Btn sm onClick={() => setBrief({ ...EMPTY_BRIEF })}><i className="ti ti-plus" />New</Btn></div>
          {briefs.length === 0 ? <p className={s.sideEmpty}>No briefs saved yet.</p> : briefs.map(b => (
            <div key={b.id} className={`${s.briefItem} ${brief.id === b.id ? s.briefActive : ''}`} onClick={() => setBrief({ ...EMPTY_BRIEF, ...b })}>
              <div className={s.briefTop}><strong>{b.brandName}</strong><button onClick={e => del(b.id, e)}><i className="ti ti-trash" /></button></div>
              <div className={s.briefMeta}>
                {b.category && <Tag color="blue">{b.category}</Tag>}
                {b.budget && <span>{money(b.budget)}</span>}
                {b.serviceFee && b.serviceFee !== '0' && <Tag color="green">+{b.serviceFee}% fee</Tag>}
              </div>
            </div>
          ))}
        </aside>

        <div>
          <Card>
            <div className={s.tableHead}>
              <SectionTitle>{brief.id ? `Editing: ${brief.brandName || 'Untitled'}` : 'New interview brief'}</SectionTitle>
              <div className={s.tools}>
                {saveState === 'saved' && <span style={{ color: 'var(--green)', fontSize: 12 }}>Saved</span>}
                {saveState === 'error' && <span style={{ color: 'var(--red)', fontSize: 12 }}>Error saving</span>}
                <Btn sm onClick={save} disabled={!brief.brandName || saveState === 'saving'}><i className="ti ti-device-floppy" />{brief.id ? 'Update brief' : 'Save brief'}</Btn>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Brand & guest</SectionTitle>
            <Row>
              <Col><FormGroup label="Brand / company *"><Input value={brief.brandName} onChange={e => upd('brandName', e.target.value)} placeholder="e.g. Acme Health" /></FormGroup></Col>
              <Col><FormGroup label="Industry / category"><Input value={brief.category} onChange={e => upd('category', e.target.value)} placeholder="e.g. Health & Wellness" /></FormGroup></Col>
            </Row>
            <FormGroup label="What does the brand do? *"><Textarea rows={3} value={brief.brandDesc} onChange={e => upd('brandDesc', e.target.value)} /></FormGroup>
            <Row>
              <Col><FormGroup label="Guest / spokesperson"><Input value={brief.guestName} onChange={e => upd('guestName', e.target.value)} placeholder="Name and title" /></FormGroup></Col>
            </Row>
            <FormGroup label="Guest background & credibility"><Textarea rows={2} value={brief.guestBio} onChange={e => upd('guestBio', e.target.value)} placeholder="Experience, achievements, book, past media…" /></FormGroup>
          </Card>

          <Card>
            <SectionTitle>Story & audience</SectionTitle>
            <FormGroup label="Topics / talking points *"><Textarea rows={3} value={brief.topics} onChange={e => upd('topics', e.target.value)} placeholder="What should the guest talk about? Angles, stories, expertise…" /></FormGroup>
            <FormGroup label="Who should hear it?"><Textarea rows={2} value={brief.targetAudience} onChange={e => upd('targetAudience', e.target.value)} /></FormGroup>
            <Row>
              <Col><FormGroup label="Goal"><Select value={brief.goal} onChange={e => upd('goal', e.target.value)}>{Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></FormGroup></Col>
              <Col><FormGroup label="Format"><Select value={brief.format} onChange={e => upd('format', e.target.value)}>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></FormGroup></Col>
            </Row>
          </Card>

          <Card>
            <SectionTitle>Budget & preferences</SectionTitle>
            <Row>
              <Col><FormGroup label="Total booking budget (USD)"><Input type="number" value={brief.budget} onChange={e => upd('budget', e.target.value)} placeholder="e.g. 15000" /></FormGroup></Col>
              <Col><FormGroup label="Number of bookings"><Input type="number" value={brief.numBookings} onChange={e => upd('numBookings', e.target.value)} /></FormGroup></Col>
              <Col>
                <FormGroup label="Service fee">
                  <Select value={brief.serviceFee || '0'} onChange={e => upd('serviceFee', e.target.value)}>
                    {['0', '10', '15', '20', '25', '30', '40', '50'].map(v => <option key={v} value={v}>{v === '0' ? 'No markup (0%)' : v + '%'}</option>)}
                  </Select>
                  {brief.serviceFee && brief.serviceFee !== '0' && <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>Prices in the offer are marked up {brief.serviceFee}%; the fee is not shown to the client.</p>}
                </FormGroup>
              </Col>
            </Row>
            <FormGroup label="Location preference"><Input value={brief.locationPref} onChange={e => upd('locationPref', e.target.value)} placeholder="e.g. NYC in-studio, or remote OK" /></FormGroup>
            <FormGroup label="Notes / must-haves / exclusions"><Textarea rows={2} value={brief.notes} onChange={e => upd('notes', e.target.value)} /></FormGroup>
          </Card>

          <div className={s.actions}><Btn onClick={onBack}><i className="ti ti-arrow-left" />Back</Btn><Btn primary disabled={!valid} onClick={onNext}>Find matching shows <i className="ti ti-arrow-right" /></Btn></div>
        </div>
      </div>
    </div>
  )
}
