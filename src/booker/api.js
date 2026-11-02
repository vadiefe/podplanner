const j = (url, method, body) => fetch(url, {
  method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined
}).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d })

export const bapi = {
  getShows: () => j('/api/booker/shows', 'GET'),
  saveShow: s => j('/api/booker/shows', 'POST', s),
  bulkSave: shows => j('/api/booker/shows/bulk', 'POST', { shows }),
  deleteShow: id => j(`/api/booker/shows/${id}`, 'DELETE'),
  deleteAllShows: () => j('/api/booker/shows', 'DELETE'),
  getBriefs: () => j('/api/booker/briefs', 'GET'),
  saveBrief: b => j('/api/booker/briefs', 'POST', b),
  deleteBrief: id => j(`/api/booker/briefs/${id}`, 'DELETE'),
  match: (shows, brief) => j('/api/booker/match', 'POST', { shows, brief }),
  saveOffer: (brief, offer) => j('/api/booker/offers', 'POST', { brief, offer }),
}

export const csvEsc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + content], { type }))
  a.download = filename
  a.click()
}
export const money = n => '$' + Math.round(n || 0).toLocaleString()
