import { Trophy, X, RotateCcw } from 'lucide-react'

function formatTime(ticks) {
  if (!ticks) return '--:--'
  const totalSeconds = Math.floor(ticks * 0.5)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function MissionSummary({ stats, weather, difficulty, agents, onRunAgain, onClose }) {

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2><Trophy size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />Mission Complete</h2>
            <div className="subtitle">
              {difficulty?.toUpperCase()} — {weather?.difficulty_label}
            </div>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <div className="label">Time to Detect</div>
            <div className="value">{formatTime(stats?.ttd)}</div>
          </div>
          <div className="stat-item">
            <div className="label">Time to Rescue</div>
            <div className="value">{formatTime(stats?.ttr)}</div>
          </div>
          <div className="stat-item">
            <div className="label">Coverage</div>
            <div className="value">{(stats?.coverage_percent || 0).toFixed(1)}%</div>
          </div>
          <div className="stat-item">
            <div className="label">Weather</div>
            <div className="value" style={{ fontSize: 16 }}>
              {weather?.wind_speed?.toFixed(1)} m/s
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {onRunAgain && (
            <button className="btn btn-warning" style={{ flex: 1, justifyContent: 'center' }} onClick={onRunAgain}>
              <RotateCcw size={14} /> Run Again
            </button>
          )}
        </div>
        
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onClose}>
          Close Report
        </button>
      </div>
    </div>
  )
}
