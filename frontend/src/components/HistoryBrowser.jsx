import { useState, useEffect } from 'react'
import { History, X, ChevronRight } from 'lucide-react'
import MissionChart from './MissionChart'

export default function HistoryBrowser({ apiUrl, onClose, onSelectMission }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'chart'

  useEffect(() => {
    fetch(`${apiUrl}/api/history`)
      .then(res => res.json())
      .then(data => {
        setMissions(data.missions || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ minWidth: 600 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={20} /> Mission Database
        </h2>
        <div className="subtitle">Select a past mission to load the flight data recorder or view analytics.</div>

        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'list' ? 'var(--cyan-400)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'list' ? '2px solid var(--cyan-400)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            📋 Mission List
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'chart' ? 'var(--cyan-400)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'chart' ? '2px solid var(--cyan-400)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            📊 Performance Chart
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading records...</div>
        ) : missions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No missions found in database. Run a live mission first.</div>
        ) : activeTab === 'chart' ? (
          <MissionChart missions={missions} />
        ) : (
          <div className="history-list">
            {missions.map(m => (
              <div key={m.id} className="history-item" onClick={() => onSelectMission(m.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Mission #{m.id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(m.timestamp).toLocaleString()} • {m.weather?.difficulty_label || m.difficulty.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: m.final_stats?.ttr ? 'var(--success)' : 'var(--danger)' }}>
                      {m.final_stats?.ttr ? 'RESCUE SUCCESS' : 'MISSION FAILED'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Coverage: {(m.final_stats?.coverage_percent || 0).toFixed(1)}%
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" style={{ marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
