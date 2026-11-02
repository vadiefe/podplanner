import { useState } from 'react'
import App from './App.jsx'
import BookerApp from './booker/BookerApp.jsx'
import s from './Root.module.css'

export default function Root() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('pp_mode') || 'home' } catch { return 'home' }
  })
  const go = m => { setMode(m); try { localStorage.setItem('pp_mode', m) } catch {} }

  if (mode === 'planner') return (<>
    <App />
    <button className={s.homeBtn} onClick={() => go('home')}>← Home</button>
  </>)
  if (mode === 'booker') return <BookerApp onHome={() => go('home')} />

  return (
    <div className={s.home}>
      <div className={s.hero}>
        <span className={s.logo}>🎙</span>
        <h1>Podcast <strong>Planner</strong></h1>
        <p>What would you like to create?</p>
      </div>
      <div className={s.choices}>
        <button className={s.choice} onClick={() => go('planner')}>
          <i className="ti ti-chart-bar" />
          <h2>Media plan</h2>
          <p>Build an ad budget plan for a brand across sponsored podcast placements, with CPMs, impressions and a budget allocation chart.</p>
          <span>Open media planner →</span>
        </button>
        <button className={s.choice} onClick={() => go('booker')}>
          <i className="ti ti-microphone-2" />
          <h2>Book a podcast interview</h2>
          <p>Match a brand or spokesperson with shows for guest interviews or sponsored episodes, and create a priced offer.</p>
          <span>Open interview booker →</span>
        </button>
      </div>
    </div>
  )
}
