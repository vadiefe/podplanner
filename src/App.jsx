import { useState } from 'react'
import RateCardPage from './pages/RateCardPage.jsx'
import BriefPage from './pages/BriefPage.jsx'
import PlanPage from './pages/PlanPage.jsx'
import ExportPage from './pages/ExportPage.jsx'
import styles from './App.module.css'

const STEPS = ['Rate Cards', 'Brand Brief', 'Media Plan', 'Export']

export default function App() {
  const [step, setStep] = useState(0)
  const [podcasts, setPodcasts] = useState([])
  const [brief, setBrief] = useState({
    brandName: '', brandDesc: '', category: '', targetAudience: '',
    ageRange: '', gender: 'all', budget: '', flightWeeks: '4',
    campaignGoal: 'awareness', notes: ''
  })
  const [plan, setPlan] = useState(null)

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
      </nav>

      <main className={styles.main}>
        {step === 0 && (
          <RateCardPage
            podcasts={podcasts}
            setPodcasts={setPodcasts}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <BriefPage
            brief={brief}
            setBrief={setBrief}
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
