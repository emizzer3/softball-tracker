import { useState, useRef } from 'react'
import { X, Download, Printer } from 'lucide-react'
import { toPng } from 'html-to-image'
import { computePlayerCard } from '../storage'
import swingPower from '../assets/cards/swing-power.svg'
import swingContact from '../assets/cards/swing-contact.svg'
import patientStance from '../assets/cards/patient-stance.svg'
import readyStance from '../assets/cards/ready-stance.svg'

const POSE_IMAGES = { power: swingPower, contact: swingContact, patient: patientStance, ready: readyStance }
const HEADLINE_LABELS = { AVG: 'BATTING AVG', OBP: 'ON-BASE %', SLG: 'SLUGGING %' }
const STAT_SHORT_LABEL = { AVG: 'CONTACT', OBP: 'ON-BASE', SLG: 'POWER', KPct: 'DISCIPLINE', BBPct: 'PATIENCE', SPRAY_BEST: 'PLACEMENT' }
const OUT_LABELS = { K: 'Strikeout', F: 'Flyout', G: 'Groundout', FC: "Fielder's Choice", SAC: 'Sacrifice' }
const SPRAY_DOT_COLORS = { '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#14532d', 'F': '#ef4444', 'G': '#dc2626', 'FC': '#f59e0b', 'SAC': '#f97316' }

// Small, non-interactive field outline for the card back — same geometry as
// SprayDiamond/SprayChart, simplified (no tap-to-inspect, fixed small size).
function MiniSprayDiagram({ dots }) {
  const home = [140, 250], lf = [9, 119], rf = [271, 119]
  return (
    <svg viewBox="0 0 280 260" style={{ width: '100%', maxWidth: 180, display: 'block', margin: '0 auto' }}>
      <path d={`M ${home[0]},${home[1]} L ${lf[0]},${lf[1]} A 185,185 0 0,1 ${rf[0]},${rf[1]} Z`} fill="#86efac" opacity="0.25" />
      <circle cx={140} cy={200} r={73} fill="#d4a264" opacity="0.25" />
      <path d={`M ${lf[0]},${lf[1]} A 185,185 0 0,1 ${rf[0]},${rf[1]}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <line x1={home[0]} y1={home[1]} x2={lf[0]} y2={lf[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      <line x1={home[0]} y1={home[1]} x2={rf[0]} y2={rf[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6} fill={SPRAY_DOT_COLORS[d.outcome] || '#6b7280'} stroke="white" strokeWidth={1} opacity={0.85} />
      ))}
    </svg>
  )
}

export function CardFront({ card }) {
  return (
    <>
      <div style={{ background: '#1c2b4a', padding: '10px 12px', textAlign: 'center' }}>
        <div style={{ color: '#f3ead9', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>{card.name}</div>
        <div style={{ color: '#c0392b', fontSize: 11, fontWeight: 'bold' }}>{card.type ? `${card.type === 'BBH' ? '⚾' : '🥎'} ${card.type} · ` : ''}MID-SEASON CARD</div>
      </div>
      <div style={{ padding: '16px 14px', textAlign: 'center' }}>
        <img src={POSE_IMAGES[card.pose]} alt={`${card.pose} pose`} style={{ width: 120, height: 120, margin: '0 auto', display: 'block' }} />
        <div style={{ marginTop: 12, fontSize: 30, fontWeight: 'bold', color: '#1c2b4a' }}>{card.headlineStat.value}</div>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c0392b', fontWeight: 'bold' }}>{HEADLINE_LABELS[card.headlineStat.key]}</div>
      </div>
      {card.strengths.length > 0 && (
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', border: '2px solid #c0392b', borderRadius: 20, color: '#c0392b', padding: '3px 10px', fontSize: 9, fontWeight: 'bold' }}>
            ⭐ TEAM STRENGTH: {STAT_SHORT_LABEL[card.strengths[0].stat] || card.strengths[0].stat}
          </span>
        </div>
      )}
    </>
  )
}

function CardBack({ card }) {
  return (
    <>
      <div style={{ background: '#1c2b4a', padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ color: '#f3ead9', fontSize: 14, fontWeight: 'bold' }}>SEASON STATS</div>
      </div>
      <div style={{ padding: '10px 14px', overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', color: '#1c2b4a', textAlign: 'center' }}>
          <tbody>
            <tr style={{ borderTop: '2px solid #1c2b4a', borderBottom: '2px solid #1c2b4a', fontWeight: 'bold' }}>
              <td style={{ padding: '4px 2px' }}>G</td><td>AB</td><td>AVG</td><td>OBP</td><td>SLG</td><td>K%</td><td>BB%</td>
            </tr>
            <tr><td style={{ padding: '4px 2px' }}>{card.G}</td><td>{card.AB}</td><td>{card.AVG}</td><td>{card.OBP}</td><td>{card.SLG}</td><td>{card.KPct}%</td><td>{card.BBPct}%</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 10, fontSize: 10, fontWeight: 'bold', color: '#1c2b4a', letterSpacing: 1, borderBottom: '1px solid #1c2b4a', paddingBottom: 3 }}>COACH'S NOTES</div>
        <div style={{ marginTop: 6 }}>
          {!card.qualifies && (
            <p style={{ fontSize: 11, color: '#1c2b4a' }}>Not enough at-bats yet (needs 5+, has {card.AB}) — check back later in the season.</p>
          )}
          {card.qualifies && card.neutral && (
            <p style={{ fontSize: 11, color: '#1c2b4a' }}>Right around team average across the board — consistent, well-rounded hitter.</p>
          )}
          {card.qualifies && !card.neutral && (
            <>
              {card.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 11, background: '#dff0d8', borderLeft: '4px solid #2f7d3c', padding: '6px 8px', color: '#1c2b4a', marginBottom: 4 }}>🟢 {s.message}</div>
              ))}
              {card.needsWork.map((s, i) => (
                <div key={i} style={{ fontSize: 11, background: '#fbe1df', borderLeft: '4px solid #c0392b', padding: '6px 8px', color: '#1c2b4a', marginBottom: 4 }}>🔴 {s.message}</div>
              ))}
            </>
          )}
        </div>

        {card.outBreakdown.mostCommon && (
          <p style={{ fontSize: 10, color: '#1c2b4a', marginTop: 8 }}>Most frequent out: <b>{OUT_LABELS[card.outBreakdown.mostCommon]}</b> ({card.outBreakdown.counts[card.outBreakdown.mostCommon]}/{card.outBreakdown.total})</p>
        )}

        {card.spray.dots.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <MiniSprayDiagram dots={card.spray.dots} />
          </div>
        )}
      </div>
    </>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function PlayerCardModal({ name, onClose }) {
  const [flipped, setFlipped] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const card = computePlayerCard(name)
  const frontRef = useRef(null)
  const backRef = useRef(null)

  async function handleDownload() {
    setDownloading(true)
    try {
      const [frontPng, backPng] = await Promise.all([
        toPng(frontRef.current, { pixelRatio: 2 }),
        toPng(backRef.current, { pixelRatio: 2 }),
      ])
      const [frontImg, backImg] = await Promise.all([loadImage(frontPng), loadImage(backPng)])
      const canvas = document.createElement('canvas')
      canvas.width = frontImg.width
      canvas.height = frontImg.height + backImg.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(frontImg, 0, 0)
      ctx.drawImage(backImg, 0, frontImg.height)
      const link = document.createElement('a')
      link.download = `${name.replace(/\s+/g, '-')}-card.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 no-print">
          <h3 className="font-bold text-base">{name}'s Card</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>

        <style>{`
          .pc-wrap { perspective: 1000px; width: 280px; margin: 0 auto; }
          .pc-inner { position: relative; width: 100%; height: 400px; transition: transform 0.6s; transform-style: preserve-3d; cursor: pointer; }
          .pc-wrap.flipped .pc-inner { transform: rotateY(180deg); }
          .pc-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px; border: 5px solid #1c2b4a; background: #f3ead9; font-family: Georgia, serif; overflow: hidden; }
          .pc-back { transform: rotateY(180deg); }
          .pc-face-flat { width: 280px; height: 400px; border-radius: 10px; border: 5px solid #1c2b4a; background: #f3ead9; font-family: Georgia, serif; overflow: hidden; position: relative; }
        `}</style>

        <div className={`pc-wrap no-print ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
          <div className="pc-inner">
            <div className="pc-face"><CardFront card={card} /></div>
            <div className="pc-face pc-back"><CardBack card={card} /></div>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2 no-print">👆 tap the card to flip it</p>

        {/* Flat, non-flipped copies used for PNG capture (Download) and for printing
            (both faces stacked). Positioned off-screen with `fixed` + a large negative
            `left` — NOT `display:none` — because html-to-image's toPng() measures
            node.clientWidth/clientHeight to size the capture; a display:none ancestor
            collapses that to 0 and produces a blank/zero-size PNG. `position:fixed`
            keeps real layout dimensions while staying invisible on screen and out of
            any ancestor's scrollable area. `print:static` restores normal flow so the
            browser's print output shows both faces stacked in place. aria-hidden keeps
            screen readers from announcing this duplicate copy. */}
        <div
          aria-hidden="true"
          className="fixed top-0 -left-[9999px] flex flex-col items-center gap-4 print:static print:left-auto"
        >
          <div ref={frontRef} className="pc-face-flat"><CardFront card={card} /></div>
          <div ref={backRef} className="pc-face-flat"><CardBack card={card} /></div>
        </div>

        <div className="flex gap-2 mt-4 no-print">
          <button onClick={handleDownload} disabled={downloading} className="btn btn-ghost btn-md flex-1 gap-1">
            <Download size={16} /> {downloading ? 'Saving…' : 'Download'}
          </button>
          <button onClick={() => window.print()} className="btn btn-ghost btn-md flex-1 gap-1">
            <Printer size={16} /> Print
          </button>
        </div>
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-2 no-print">Close</button>
      </div>
    </div>
  )
}
