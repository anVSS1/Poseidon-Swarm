import { Brain, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ArrowUpLeft, ArrowDownRight, ArrowDownLeft, Pause } from 'lucide-react'

const ACTION_ICONS = {
  0: Pause,       // HOLD
  1: ArrowUp,     // N
  2: ArrowUpRight,// NE
  3: ArrowRight,  // E
  4: ArrowDownRight,// SE
  5: ArrowDown,   // S
  6: ArrowDownLeft,// SW
  7: ArrowLeft,   // W
  8: ArrowUpLeft   // NW
}

const ACTION_NAMES = {
  0: 'HOLD', 1: 'N', 2: 'NE', 3: 'E', 4: 'SE', 5: 'S', 6: 'SW', 7: 'W', 8: 'NW'
}

export default function AIDecisionPanel({ logs, agents, selectedAgent }) {
  // Extract the latest RL decisions from logs
  const rlLogs = (logs || [])
    .filter(l => l.message && l.message.includes('RL action='))
    .slice(-5)
    .reverse()

  // Parse action from log message
  const parseAction = (msg) => {
    const match = msg.match(/RL action=(\d)/)
    return match ? parseInt(match[1]) : 0
  }

  const parseCoverage = (msg) => {
    const match = msg.match(/Coverage: ([\d.]+)%/)
    return match ? parseFloat(match[1]) : null
  }

  const activeAgentKey = selectedAgent && agents?.[selectedAgent] ? selectedAgent : (agents && Object.keys(agents).length > 0 ? Object.keys(agents)[0] : null)
  const activeAgent = activeAgentKey ? agents[activeAgentKey] : null
  const observation = activeAgent?.observation || []

  return (
    <div className="ai-decision-panel">
      <div className="panel-header">
        <Brain className="icon" />
        AI DECISION ENGINE
      </div>
      <div className="ai-decisions-list">
        {rlLogs.length === 0 ? (
          <div className="ai-empty">
            <Brain size={24} color="var(--text-dim)" />
            <span>Awaiting RL inference...</span>
          </div>
        ) : (
          rlLogs.map((log, i) => {
            const action = parseAction(log.message)
            const coverage = parseCoverage(log.message)
            const ActionIcon = ACTION_ICONS[action] || Pause
            const agentColor = log.source.includes('scout') ? 'var(--scout-color)' : 
                               log.source.includes('spotter') ? 'var(--spotter-color)' : 'var(--rescuer-color)'
            
            return (
              <div key={i} className={`ai-decision-row ${i === 0 ? 'latest' : ''}`}>
                <div className="ai-agent-tag" style={{ borderColor: agentColor, color: agentColor }}>
                  {log.source.replace('_', ' ').toUpperCase()}
                </div>
                <div className="ai-action-icon" style={{ color: agentColor }}>
                  <ActionIcon size={16} />
                  <span className="ai-action-name">{ACTION_NAMES[action]}</span>
                </div>
                {coverage !== null && (
                  <div className="ai-coverage-badge">
                     {coverage.toFixed(1)}%
                  </div>
                )}
                <span className="ai-timestamp">{log.timestamp}</span>
              </div>
            )
          })
        )}
      </div>
      
      {/* Observation Vector Display */}
      {agents && Object.keys(agents).length > 0 && (
        <div className="ai-obs-section">
          <div className="ai-obs-label">
            Live Observation Vector (35-dim) · {activeAgentKey?.replace('_', ' ').toUpperCase()}
          </div>
          <div className="ai-obs-vector">
            {observation.length > 0 ? (
              observation.map((val, i) => (
                <span key={i} className="ai-obs-val" title={`Index ${i}: ${val}`}>
                  {val.toFixed(2)}
                </span>
              ))
            ) : (
              Array.from({length: 35}, (_, i) => (
                <span key={i} className="ai-obs-val" title="Awaiting simulation tick…">
                  0.00
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
