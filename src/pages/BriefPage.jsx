import { useState } from 'react'
import { Card, SectionTitle, Btn, FormGroup, Input, Select, Textarea, Row, Col, Tag } from '../components/UI.jsx'
import { api } from '../App.jsx'
import s from './BriefPage.module.css'

const INDUSTRIES = [
  'Health & Wellness', 'Finance & Investing', 'Technology', 'E-commerce',
  'Education', 'Food & Drink', 'Travel', 'Entertainment', 'B2B / SaaS',
  'Consumer Goods', 'Beauty & Fashion', 'Automotive', 'Real Estate', 'Other'
]

const EMPTY_BRIEF = {
  id: '', brandName: '', brandDesc: '', category: '', targetAudience: '',
  ageRange: '', gender: 'all', budget: '', flightWeeks: '4',
  campaignGoal: 'awareness', notes: '', commissionRate: '0'
}

function goalLabel(g) {
  return { awareness: 'Awareness', consideration: 'Consideration', conversion: 'Conversion', retention: 'Retention' }[g] || g
}

export default function BriefPage({ brief, setBrief, savedBriefs, setSavedBriefs, dbReady, onNext, onBack }) {
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'saved' | 'error'
  const [activeBriefId, setActiveBriefId] = useState(null)

  const upd = (k, v) => setBrief(b => ({ ...b, [k]: v }))
  const valid = brief.brandName && brief.brandDesc && brief.budget && brief.targetAudience

  // Save or update the current brief
  async function handleSave() {
    if (!brief.brandName) return
    setSaveStatus('saving')
    try {
      const id = activeBriefId || String(Date.now())
      const toSave = { ...brief, id }
      await api.saveBrief(toSave)
      setSavedBriefs(prev => {
        const existing = prev.findIndex(b => b.id === id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { ...toSave, updatedAt: new Date().toISOString() }
          return updated
        }
        return [{ ...toSave, updatedAt: new Date().toISOString() }, ...prev]
      })
      setActiveBriefId(id)
      setBrief(b => ({ ...b, id }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  // Load a saved brief into the editor
  function loadBrief(saved) {
    setBrief({ ...EMPTY_BRIEF, ...saved, commissionRate: saved.commissionRate || '0' })
    setActiveBriefId(saved.id)
  }

  // New blank brief
  function newBrief() {
    setBrief({ ...EMPTY_BRIEF })
    setActiveBriefId(null)
  }

  // Delete a saved brief
  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this brief?')) return
    try {
      await api.deleteBrief(id)
      setSavedBriefs(prev => prev.filter(b => b.id !== id))
      if (activeBriefId === id) {
        setBrief({ ...EMPTY_BRIEF })
        setActiveBriefId(null)
      }
    } catch { alert('Failed to delete brief') }
  }

  const isEdited = activeBriefId && savedBriefs.find(b => b.id === activeBriefId) &&
    JSON.stringify({ ...brief, id: activeBriefId, updatedAt: undefined, createdAt: undefined }) !==
    JSON.stringify({ ...savedBriefs.find(b => b.id === activeBriefId), updatedAt: undefined, createdAt: undefined })

  return (
    <div className="fade-in">
      <div className={s.layout}>

        {/* ── Left: Saved briefs sidebar ── */}
        <div className={s.sidebar}>
          <div className={s.sidebarHeader}>
            <p className={s.sidebarTitle}>Saved briefs</p>
            <Btn sm onClick={newBrief}><i className="ti ti-plus" />New</Btn>
          </div>

          {savedBriefs.length === 0 ? (
            <div className={s.sidebarEmpty}>
              <i className="ti ti-file-description" />
              <p>No briefs saved yet.</p>
              <p>Fill in the form and click Save.</p>
            </div>
          ) : (
            <div className={s.briefList}>
              {savedBriefs.map(b => (
                <div
                  key={b.id}
                  className={`${s.briefCard} ${activeBriefId === b.id ? s.briefCardActive : ''}`}
                  onClick={() => loadBrief(b)}
                >
                  <div className={s.briefCardTop}>
                    <span className={s.briefCardName}>{b.brandName}</span>
                    <button className={s.briefCardDelete} onClick={e => handleDelete(b.id, e)}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                  <div className={s.briefCardMeta}>
                    {b.category && <Tag color="blue">{b.category}</Tag>}
                    {b.budget && <span className={s.briefCardBudget}>${Number(b.budget).toLocaleString()}</span>}
                    {b.campaignGoal && <Tag>{goalLabel(b.campaignGoal)}</Tag>}
                    {b.commissionRate && b.commissionRate !== '0' && <Tag color="green">+{b.commissionRate}% fee</Tag>}
                  </div>
                  {b.updatedAt && (
                    <p className={s.briefCardDate}>
                      {new Date(b.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Brief editor ── */}
        <div className={s.editor}>
          <Card>
            <div className={s.editorHeader}>
              <SectionTitle style={{ margin: 0 }}>
                {activeBriefId ? `Editing: ${brief.brandName || 'Untitled'}` : 'New brief'}
                {isEdited && <span className={s.unsaved}> · unsaved changes</span>}
              </SectionTitle>
              <div className={s.saveActions}>
                {saveStatus === 'saving' && <span className={s.saveMsg}><i className="ti ti-loader spin" /> Saving…</span>}
                {saveStatus === 'saved' && <span className={s.saveMsg} style={{ color: 'var(--green)' }}><i className="ti ti-check" /> Saved</span>}
                {saveStatus === 'error' && <span className={s.saveMsg} style={{ color: 'var(--red)' }}><i className="ti ti-alert-circle" /> Error saving</span>}
                <Btn sm onClick={handleSave} disabled={!brief.brandName || saveStatus === 'saving'}>
                  <i className="ti ti-device-floppy" />
                  {activeBriefId ? 'Update brief' : 'Save brief'}
                </Btn>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Brand information</SectionTitle>
            <Row>
              <Col>
                <FormGroup label="Brand / company name *">
                  <Input value={brief.brandName} onChange={e => upd('brandName', e.target.value)} placeholder="e.g. Headspace" />
                </FormGroup>
              </Col>
              <Col>
                <FormGroup label="Industry / category">
                  <Select value={brief.category} onChange={e => upd('category', e.target.value)}>
                    <option value="">Select…</option>
                    {INDUSTRIES.map(c => <option key={c}>{c}</option>)}
                  </Select>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup label="What does the brand do? *">
              <Textarea rows={3} value={brief.brandDesc} onChange={e => upd('brandDesc', e.target.value)}
                placeholder="Describe the product or service, unique value proposition, and what makes it stand out…" />
            </FormGroup>
          </Card>

          <Card>
            <SectionTitle>Target audience</SectionTitle>
            <FormGroup label="Audience description *">
              <Textarea rows={2} value={brief.targetAudience} onChange={e => upd('targetAudience', e.target.value)}
                placeholder="e.g. Busy professionals aged 25–45, interested in mindfulness, stress reduction, and productivity…" />
            </FormGroup>
            <Row>
              <Col>
                <FormGroup label="Age range">
                  <Select value={brief.ageRange} onChange={e => upd('ageRange', e.target.value)}>
                    <option value="">Any</option>
                    {['18–24', '25–34', '35–44', '45–54', '55+', '18–34', '25–44', '35–54'].map(a => <option key={a}>{a}</option>)}
                  </Select>
                </FormGroup>
              </Col>
              <Col>
                <FormGroup label="Gender skew">
                  <Select value={brief.gender} onChange={e => upd('gender', e.target.value)}>
                    <option value="all">All genders</option>
                    <option value="male">Male skew</option>
                    <option value="female">Female skew</option>
                  </Select>
                </FormGroup>
              </Col>
              <Col>
                <FormGroup label="Primary campaign goal">
                  <Select value={brief.campaignGoal} onChange={e => upd('campaignGoal', e.target.value)}>
                    <option value="awareness">Brand awareness</option>
                    <option value="consideration">Consideration / education</option>
                    <option value="conversion">Direct response / conversion</option>
                    <option value="retention">Retention / loyalty</option>
                  </Select>
                </FormGroup>
              </Col>
            </Row>
          </Card>

          <Card>
            <SectionTitle>Campaign budget & flight</SectionTitle>
            <Row>
              <Col>
                <FormGroup label="Total budget (USD) *">
                  <Input type="number" value={brief.budget} onChange={e => upd('budget', e.target.value)} placeholder="e.g. 50000" />
                </FormGroup>
              </Col>
              <Col>
                <FormGroup label="Flight length">
                  <Select value={brief.flightWeeks} onChange={e => upd('flightWeeks', e.target.value)}>
                    {[2, 4, 6, 8, 12, 16, 24, 52].map(w => <option key={w} value={w}>{w} weeks</option>)}
                  </Select>
                </FormGroup>
              </Col>
              <Col>
                <FormGroup label="Commission / service fee">
                  <Select value={brief.commissionRate || '0'} onChange={e => upd('commissionRate', e.target.value)}>
                    <option value="0">No markup (0%)</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                    <option value="25">25%</option>
                    <option value="30">30%</option>
                    <option value="40">40%</option>
                    <option value="50">50%</option>
                  </Select>
                  {brief.commissionRate && brief.commissionRate !== '0' && (
                    <p style={{fontSize:11,color:'var(--green)',marginTop:4}}>✓ Costs will be marked up {brief.commissionRate}% in the client plan</p>
                  )}
                </FormGroup>
              </Col>
            </Row>
            <FormGroup label="Additional notes / must-haves / exclusions">
              <Textarea rows={2} value={brief.notes} onChange={e => upd('notes', e.target.value)}
                placeholder="e.g. Must include true crime. Exclude comedy. Prefer shows with engaged communities…" />
            </FormGroup>
          </Card>

          <div className={s.actions}>
            <Btn onClick={onBack}><i className="ti ti-arrow-left" />Back</Btn>
            <Btn primary disabled={!valid} onClick={onNext}>
              Generate media plan <i className="ti ti-arrow-right" />
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
