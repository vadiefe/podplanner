import { useState, useEffect, useCallback } from 'react'
import RateCardPage from './pages/RateCardPage.jsx'
import BriefPage from './pages/BriefPage.jsx'
import PlanPage from './pages/PlanPage.jsx'
import ExportPage from './pages/ExportPage.jsx'
import styles from './App.module.css'

const STEPS = ['Rate Cards', 'Brand Brief', 'Media Plan', 'Export']

// ── API helpers ───────────────────────────────────────────────────────────────
const api = {
  // Shows
  getShows: () => fetch('/api/shows').then(r => r.json()),
  saveShow: (show) => fetch('/api/shows', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(show)
  }).then(r => r.json()),
  bulkSave: (shows) => fetch('/api/shows/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shows })
  }).then(r => r.json()),
  deleteShow: (id) => fetch(`/api/shows/${id}`, { method: 'DELETE' }).then(r => r.json()),
  deleteAllShows: () => fetch('/api/shows', { method: 'DELETE' }).then(r => r.json()),
  // Briefs
  getBriefs: () => fetch('/api/briefs').then(r => r.json()),
  saveBrief: (brief) => fetch('/api/briefs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brief)
  }).then(r => r.json()),
  deleteBrief: (id) => fetch(`/api/briefs/${id}`, { method: 'DELETE' }).then(r => r.json()),
}

export { api }

export default function App() {
  const [step, setStep] = useState(0)
  const [podcasts, setPodcasts] = useState([])
  const [dbReady, setDbReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [brief, setBrief] = useState({
    brandName: '', brandDesc: '', category: '', targetAudience: '',
    ageRange: '', gender: 'all', budget: '', flightWeeks: '4',
    campaignGoal: 'awareness', notes: '', commissionRate: '0'
  })
  const [plan, setPlan] = useState(null)
  const [savedBriefs, setSavedBriefs] = useState([])

  // Load shows from DB on mount
  useEffect(() => {
    Promise.all([api.getShows(), api.getBriefs()])
      .then(([shows, briefs]) => {
        if (Array.isArray(shows)) setPodcasts(shows)
        if (Array.isArray(briefs)) setSavedBriefs(briefs)
        setDbReady(true)
      })
      .catch(err => {
        console.error('Could not load from DB:', err)
        setLoadError('Could not connect to database. Changes will not be saved.')
        setDbReady(true)
      })
  }, [])

  const stepDone = [
    podcasts.length > 0,
    !!(brief.brandName && brief.brandDesc && brief.budget && brief.targetAudience),
    !!plan,
    false
  ]

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🎙</span>
          <span className={styles.logoText}>Podcast <strong>Planner</strong></span>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <button
              key={i}
              className={[
                styles.step,
                step === i ? styles.stepActive : '',
                stepDone[i] && step !== i ? styles.stepDone : ''
              ].join(' ')}
              onClick={() => setStep(i)}
            >
              <span className={styles.stepNum}>
                {stepDone[i] && step !== i
                  ? <i className="ti ti-check" style={{ fontSize: 10 }} />
                  : i + 1}
              </span>
              {s}
            </button>
          ))}
        </div>
        {/* DB status indicator */}
        <div className={styles.dbStatus}>
          {!dbReady
            ? <span className={styles.dbLoading}><i className="ti ti-loader spin" /> Loading…</span>
            : loadError
              ? <span className={styles.dbError} title={loadError}><i className="ti ti-cloud-off" /> No DB</span>
              : <span className={styles.dbOk}><i className="ti ti-cloud-check" /> {podcasts.length} shows saved</span>
          }
        </div>
      </nav>

      <main className={styles.main}>
        {loadError && (
          <div className={styles.errorBanner}>
            <i className="ti ti-alert-circle" /> {loadError}
          </div>
        )}
        {step === 0 && (
          <RateCardPage
            podcasts={podcasts}
            setPodcasts={setPodcasts}
            dbReady={dbReady}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <BriefPage
            brief={brief}
            setBrief={setBrief}
            savedBriefs={savedBriefs}
            setSavedBriefs={setSavedBriefs}
            dbReady={dbReady}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <PlanPage
            podcasts={podcasts}
            brief={brief}
            plan={plan}
            setPlan={setPlan}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <ExportPage
            plan={plan}
            brief={brief}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  )
}
