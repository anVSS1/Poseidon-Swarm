import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react'

export default function TimelineScrubber({ historyLength, currentIndex, onIndexChange, isPlaying, onTogglePlay, onExit }) {
  if (historyLength === 0) return null

  const progress = (currentIndex / (historyLength - 1)) * 100

  return (
    <div className="replay-scrubber">
      <div className="replay-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)', fontWeight: 600 }}>
          <div className="record-dot" /> FLIGHT DATA REPLAY
        </div>
        <button className="btn-icon" onClick={onExit} title="Exit Replay Mode">
          <X size={16} />
        </button>
      </div>
      
      <div className="replay-controls">
        <button className="btn-icon" onClick={() => onIndexChange(0)} title="Restart">
          <SkipBack size={16} />
        </button>
        <button className="btn-icon" onClick={onTogglePlay} style={{ color: 'var(--cyan-400)' }}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="btn-icon" onClick={() => onIndexChange(historyLength - 1)} title="Go to End">
          <SkipForward size={16} />
        </button>
        
        <div className="timeline-track-container">
          <input 
            type="range" 
            min="0" 
            max={historyLength - 1} 
            value={currentIndex} 
            onChange={(e) => onIndexChange(parseInt(e.target.value))}
            className="timeline-track"
            style={{ '--progress': `${progress}%` }}
          />
        </div>
        
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 50, textAlign: 'right' }}>
          T+{(currentIndex*0.5).toFixed(1)}s
        </div>
      </div>
    </div>
  )
}
