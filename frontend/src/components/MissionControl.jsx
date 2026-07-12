import { Anchor, Play, Pause, Zap, Radio, History, Info, Sun, Moon, Globe, XCircle, Volume2, VolumeX } from 'lucide-react'

const LANG_FLAGS = { en: '🇬🇧', fr: '🇫🇷', ar: '🇲🇦' }

export default function MissionControl({ state, connected, onStart, onPause, onResume, onAbort, onOpenHistory, onOpenGuide, lang, t, darkMode, onToggleDark, onChangeLang, wsLatency, speed = 1.0, onChangeSpeed, soundMuted = false, onToggleSound }) {
  const status = state?.mission_status || 'idle'

  const cycleLang = () => {
    const langs = ['en', 'fr', 'ar']
    const idx = (langs.indexOf(lang) + 1) % langs.length
    onChangeLang(langs[idx])
  }

  return (
    <header className="mission-control">
      {/* Brand */}
      <div className="mc-brand">
        <Anchor className="logo-icon" />
        <h1>{t?.title || 'POSEIDON SWARM'}</h1>
        <span className="version">REAL-TIME</span>
      </div>

      {/* Controls */}
      <div className="mc-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
          <Radio size={12} color="var(--cyan-400)" />
          <span>Agadir Coast — Live Weather</span>
        </div>

        {status === 'idle' || status === 'finished' ? (
          <>
            <button className="btn" onClick={onOpenGuide} title="How it Works (G)">
              <Info size={14} color="var(--cyan-400)" />
              {t?.systemGuide || 'System Guide'}
            </button>
            <button className="btn" onClick={onOpenHistory}>
              <History size={14} />
              {t?.replayDb || 'Replay DB'}
            </button>
            <button className="btn btn-warning" onClick={() => onStart('demo', false)}>
              <Play size={14} />
              {t?.runDemo || 'Run System Demo'}
            </button>
            <button className="btn btn-primary" onClick={() => onStart('physical', true)}>
              <Zap size={14} />
              {t?.deployFleet || 'Deploy FLEET (Live RT)'}
            </button>
            {status === 'finished' && (
              <button className="btn btn-danger" onClick={onAbort} title="Clear Map board">
                <XCircle size={14} />
                {lang === 'ar' ? 'مسح الخريطة' : lang === 'fr' ? 'Effacer la Carte' : 'Clear Board'}
              </button>
            )}
          </>
        ) : status === 'awaiting_hardware' ? (
          <button className="btn btn-danger" disabled>
            <Zap size={14} />
            Awaiting Drone Uplink...
          </button>
        ) : (status === 'active' || status === 'paused') ? (
          <>
            {onChangeSpeed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8, background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '0 4px' }}>Speed:</span>
                {[1, 2, 4].map(s => (
                  <button
                    key={s}
                    className="btn btn-sm"
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      height: '20px',
                      minWidth: '24px',
                      background: speed === s ? 'var(--cyan-600)' : 'transparent',
                      borderColor: speed === s ? 'var(--cyan-500)' : 'transparent',
                      color: speed === s ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => onChangeSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
            {status === 'active' ? (
              <button className="btn btn-warning" onClick={onPause}>
                <Pause size={14} />
                {t?.pause || 'Pause'} <kbd style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>Space</kbd>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onResume}>
                <Play size={14} />
                {t?.resume || 'Resume'} <kbd style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>Space</kbd>
              </button>
            )}
            <button className="btn btn-danger" onClick={onAbort}>
              <XCircle size={14} />
              Abort
            </button>
          </>
        ) : null}
      </div>

      {/* Status + Settings */}
      <div className="mc-status">
        {/* Theme Toggle */}
        <button className="mc-icon-btn" onClick={onToggleDark} title="Toggle Theme">
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Sound Toggle */}
        <button className="mc-icon-btn" onClick={onToggleSound} title={soundMuted ? "Unmute Sound" : "Mute Sound"}>
          {soundMuted ? <VolumeX size={14} color="var(--danger)" /> : <Volume2 size={14} />}
        </button>
        
        {/* Language Toggle */}
        <button className="mc-icon-btn" onClick={cycleLang} title="Change Language">
          <span style={{ fontSize: 14 }}>{LANG_FLAGS[lang]}</span>
        </button>

        {/* Connection Status */}
        <div className="mc-connection-badge" title={`WebSocket ${connected ? 'Connected' : 'Disconnected'}`}>
          <span className={`mc-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? (t?.live || 'LIVE') : (t?.offline || 'OFFLINE')}</span>
          {connected && wsLatency && (
            <span className="mc-latency">{Math.min(wsLatency, 999)}ms</span>
          )}
        </div>

        <span className={`status-badge ${status}`}>
          {(t?.[status] || status).toUpperCase()}
        </span>
      </div>
    </header>
  )
}
