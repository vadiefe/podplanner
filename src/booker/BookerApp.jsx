import { useState, useEffect } from 'react'
import ShowsPage from './ShowsPage.jsx'
import BriefPage, { EMPTY_BRIEF } from './BriefPage.jsx'
import MatchPage from './MatchPage.jsx'
import OfferPage from './OfferPage.jsx'
import { bapi } from './api.js'
import s from './booker.module.css'

const STEPS = ['Interview library', 'Brand brief', 'Matches', 'Offer']

export default function BookerApp({ onHome }) {
  const [step, setStep] = useState(0)
  const [shows, setShows] = useState([])
  const [briefs, setBriefs] = useState([])
  const [brief, setBrief] = useState({ ...EMPTY_BRIEF })
  const [match, setMatch] = useState(null)
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState('')

  useEffect(() => {
    Promise.all([bapi.getShows(), bapi.getBriefs()])
      .then(([sh, br]) => { if (Array.isArray(sh)) setShows(sh); if (Array.isArray(br)) setBriefs(br); setDbReady(true) })
      .catch(e => { setDbError('Could not connect to the database. Changes will not be saved.'); setDbReady(false) })
  }, [])

  return (
    <div className={s.app}>
      <nav className={s.nav}>
        <button className={s.home} onClick={onHome}>← Home</button>
        <div className={s.logo}>🎙 Interview <strong>Booker</strong></div>
        <div className={s.steps}>
          {STEPS.map((t, i) => (
            <button key={t} className={`${s.step} ${step === i ? s.stepActive : ''}`} onClick={() => setStep(i)}>
              <span className={s.num}>{i + 1}</span>{t}
            </button>
          ))}
        </div>
        <div className={s.db}>{dbError ? <span style={{ color: 'var(--red)' }}>No DB</span> : <span style={{ color: 'var(--green)' }}>{shows.length} shows saved</span>}</div>
      </nav>
      <main className={s.main}>
        {dbError && <div className={`${s.status} ${s.error}`}>{dbError}</div>}
        {step === 0 && <ShowsPage shows={shows} setShows={setShows} dbReady={dbReady} onNext={() => setStep(1)} />}
        {step === 1 && <BriefPage brief={brief} setBrief={setBrief} briefs={briefs} setBriefs={setBriefs} dbReady={dbReady} onBack={() => setStep(0)} onNext={() => { setMatch(null); setStep(2) }} />}
        {step === 2 && <MatchPage shows={shows} brief={brief} match={match} setMatch={setMatch} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <OfferPage brief={brief} match={match} onBack={() => setStep(2)} />}
      </main>
    </div>
  )
}
