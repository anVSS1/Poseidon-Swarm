import { Activity, Battery, Crosshair, Clock, BarChart3 } from 'lucide-react'

function formatTime(seconds) {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTimeLive(ticks) {
  if (!ticks) return '00:00'
  const totalSeconds = Math.floor(ticks * 0.5) // 500ms per tick
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getBatteryClass(level) {
  if (level > 60) return 'high'
  if (level > 25) return 'medium'
  return 'low'
}

const AGENT_LABELS = {
  scout_1: 'Scout Alpha',
  scout_2: 'Scout Bravo',
  spotter_1: 'Spotter One',
  rescuer_1: 'Rescuer One',
  rescuer_2: 'Rescuer Two'
}

export default function Telemetry({ stats, agents, missionStatus, timeStep, selectedAgent, onSelectAgent }) {
  return (
    <>
      <div className="panel-header">
        <Activity className="icon" />
        MISSION TELEMETRY
      </div>
      <div className="panel-body">
        {/* Mission Timer */}
        <div className="stat-card">
          <div className="stat-label"><Clock size={10} style={{ marginRight: 4 }} />Mission Time</div>
          <div className="stat-value">{formatTimeLive(timeStep)}</div>
        </div>

        {/* TTD */}
        <div className="stat-card">
          <div className="stat-label"><Crosshair size={10} style={{ marginRight: 4 }} />Time to Detect</div>
          <div className={`stat-value ${stats?.ttd ? 'success' : ''}`}>
            {stats?.ttd ? formatTime(Math.floor(stats.ttd * 0.5)) : (missionStatus === 'active' ? 'SEARCHING...' : '--:--')}
          </div>
        </div>

        {/* TTR */}
        <div className="stat-card">
          <div className="stat-label"><Crosshair size={10} style={{ marginRight: 4 }} />Time to Rescue</div>
          <div className={`stat-value ${stats?.ttr ? 'success' : ''}`}>
            {stats?.ttr ? formatTime(Math.floor(stats.ttr * 0.5)) : (missionStatus === 'active' ? 'PENDING...' : '--:--')}
          </div>
        </div>

        {/* Coverage */}
        <div className="stat-card">
          <div className="stat-label"><BarChart3 size={10} style={{ marginRight: 4 }} />Area Coverage</div>
          <div className="stat-value">{(stats?.coverage_percent || 0).toFixed(1)}%</div>
          <div className="progress-bar">
            <div className="fill" style={{ width: `${stats?.coverage_percent || 0}%` }} />
          </div>
        </div>

        {/* Agent Cards */}
        <div style={{ marginTop: 12 }}>
          <div className="panel-header" style={{ padding: '8px 0', borderBottom: 'none' }}>
            FLEET STATUS
          </div>
          {agents && Object.entries(agents).map(([id, agent]) => {
            const isLowBat = agent.battery < 20
            return (
              <div
                key={id}
                className={`agent-card ${agent.type} ${selectedAgent === id ? 'active' : ''} ${isLowBat ? 'low-battery' : ''}`}
                onClick={() => onSelectAgent(selectedAgent === id ? null : id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="agent-name">
                  <span>{AGENT_LABELS[id] || id}</span>
                  <span className={`agent-status-text ${agent.status}`}>
                    {agent.status}
                  </span>
                </div>
                <div className="agent-meta">
                  <span style={isLowBat ? { color: 'var(--danger)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '2px' } : {}}>
                    <Battery size={10} /> {agent.battery.toFixed(1)}% {isLowBat && '⚠️ LOW BATTERY'}
                  </span>
                  <span>{agent.lat.toFixed(4)}, {agent.lng.toFixed(4)}</span>
                </div>
                <div className="battery-bar">
                  <div
                    className={`fill ${getBatteryClass(agent.battery)}`}
                    style={{ width: `${agent.battery}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
