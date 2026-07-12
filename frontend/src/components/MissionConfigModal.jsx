import { useState } from 'react'
import { X, Settings, Sliders, Users, Target, Crosshair } from 'lucide-react'

export default function MissionConfigModal({ onClose, onConfirm, sosLocation, mode }) {
  const droneCount = 2
  const spotterCount = 1
  const rescuerCount = 2
  const [difficulty, setDifficulty] = useState('medium')
  const [blindSearch, setBlindSearch] = useState(false)
  const searchRadius = 15

  const handleConfirm = () => {
    onConfirm({
      difficulty,
      drone_count: droneCount,
      spotter_count: spotterCount,
      rescuer_count: rescuerCount,
      search_radius_km: searchRadius,
      blind_search: blindSearch,
      target_lat: sosLocation[0],
      target_lng: sosLocation[1]
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card config-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan-400)', marginBottom: 6 }}>
          <Settings size={22} /> Mission Configuration
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Configure search parameters before deploying the trained MAPPO fleet.
        </p>

        {/* SOS Coordinates Display */}
        <div className="config-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="config-label" style={{ marginBottom: 0 }}>
              <Crosshair size={14} color="var(--danger)" /> SOS Coordinates
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={blindSearch} 
                onChange={(e) => setBlindSearch(e.target.checked)} 
              />
              Blind Search
            </label>
          </div>
          
          <div style={{ 
            fontFamily: 'var(--font-mono)', fontSize: 13, color: blindSearch ? 'var(--text-dim)' : 'var(--text-primary)', 
            padding: '8px 12px', background: 'var(--bg-deep)', borderRadius: 6, border: '1px solid var(--border-subtle)',
            opacity: blindSearch ? 0.5 : 1
          }}>
            {blindSearch ? 'UNKNOWN (Sweeping coast)' : `${sosLocation[0].toFixed(4)}°N, ${sosLocation[1].toFixed(4)}°W`}
          </div>
          {!blindSearch && <span className="config-hint">Click on the Tactical Map to change the SOS location</span>}
        </div>

        {/* Fleet Composition (Locked to PPO Trained Fleet Size) */}
        <div className="config-section">
          <label className="config-label">
            <Users size={14} color="var(--cyan-400)" /> Swarm Composition (Locked)
          </label>
          <div className="config-row">
            <div className="config-field">
              <span className="config-field-label">🛸 Scouts</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--scout-color)' }}>2</span>
            </div>
            <div className="config-field">
              <span className="config-field-label">🔍 Spotters</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--spotter-color)' }}>1</span>
            </div>
            <div className="config-field">
              <span className="config-field-label">🚤 Rescuers</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--rescuer-color)' }}>2</span>
            </div>
          </div>
          <span className="config-hint" style={{ color: 'var(--cyan-500)', fontStyle: 'normal', marginTop: 8, display: 'block' }}>
            🔒 Fleet size locked to exactly 5 agents matching the trained MAPPO PPO policy observation layer.
          </span>
        </div>

        {/* Search Area (Locked to PPO Trained Grid Size) */}
        <div className="config-section">
          <label className="config-label">
            <Target size={14} color="var(--warning)" /> Search Area (Locked)
          </label>
          <div className="config-row">
            <div className="config-field" style={{ flex: 1 }}>
              <span className="config-field-label">📐 Grid Dimensions</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>30 x 30 km</span>
            </div>
            <div className="config-field" style={{ flex: 1 }}>
              <span className="config-field-label">⭕ Search Radius</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>15 km</span>
            </div>
          </div>
          <span className="config-hint" style={{ color: 'var(--warning)', fontStyle: 'normal', marginTop: 8, display: 'block' }}>
            🔒 Search area is fixed to 30x30 km (15 km radius) matching the trained MAPPO PPO policy grid resolution.
          </span>
        </div>

        {/* Difficulty */}
        <div className="config-section">
          <label className="config-label">
            <Sliders size={14} color="var(--success)" /> Sea Conditions
          </label>
          {mode === 'physical' ? (
            <div style={{ fontSize: 12, color: 'var(--cyan-400)', background: 'rgba(34, 211, 238, 0.1)', padding: '8px', borderRadius: 6, border: '1px solid rgba(34, 211, 238, 0.2)' }}>
              ☁️ Using Live RT Weather Data for Agadir Coast.
            </div>
          ) : (
            <div className="config-difficulty-row">
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  className={`config-diff-btn ${difficulty === d ? 'active' : ''} ${d}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d === 'easy' ? '🌊 Calm' : d === 'medium' ? '🌬️ Moderate' : '🌪️ Stormy'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} style={{ flex: 2 }}>
            Deploy 5 Swarm Agents
          </button>
        </div>
      </div>
    </div>
  )
}
