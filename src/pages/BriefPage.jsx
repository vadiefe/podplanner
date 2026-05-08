import { Card, SectionTitle, Btn, FormGroup, Input, Select, Textarea, Row, Col } from '../components/UI.jsx'
import s from './BriefPage.module.css'

const INDUSTRIES = [
  'Health & Wellness', 'Finance & Investing', 'Technology', 'E-commerce',
  'Education', 'Food & Drink', 'Travel', 'Entertainment', 'B2B / SaaS',
  'Consumer Goods', 'Beauty & Fashion', 'Automotive', 'Real Estate', 'Other'
]

export default function BriefPage({ brief, setBrief, onNext, onBack }) {
  const upd = (k, v) => setBrief(b => ({ ...b, [k]: v }))
  const valid = brief.brandName && brief.brandDesc && brief.budget && brief.targetAudience

  return (
    <div className="fade-in">
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
  )
}
