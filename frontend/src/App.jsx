import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import 'leaflet/dist/leaflet.css'

import MissionControl from './components/MissionControl'
import TacticalMap from './components/TacticalMap'
import Telemetry from './components/Telemetry'
import WeatherPanel from './components/WeatherPanel'
import CommLink from './components/CommLink'
import VideoFeed from './components/VideoFeed'
import AlertSystem from './components/AlertSystem'
import MissionSummary from './components/MissionSummary'
import HistoryBrowser from './components/HistoryBrowser'
import TimelineScrubber from './components/TimelineScrubber'
import GuidedTour from './components/GuidedTour'
import MissionConfigModal from './components/MissionConfigModal'
import AIDecisionPanel from './components/AIDecisionPanel'

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:8000/ws`;
}

const API_URL = getApiUrl()
const WS_URL = getWsUrl()


// ── Multi-language support ──
const LANG = {
  en: {
    title: 'POSEIDON SWARM',
    idle: 'IDLE', active: 'ACTIVE', paused: 'PAUSED', finished: 'FINISHED',
    live: 'LIVE', offline: 'OFFLINE',
    systemGuide: 'System Guide', replayDb: 'Replay DB',
    runDemo: 'Run System Demo', deployFleet: 'Deploy FLEET (Live RT)',
    pause: 'Pause', resume: 'Resume',
    targetDetected: '⚠️ TARGET DETECTED by Scout!',
    rescueComplete: '✅ RESCUE COMPLETE — Mission Successful!',
    latency: 'Latency',
  },
  fr: {
    title: 'POSEIDON ESSAIM',
    idle: 'INACTIF', active: 'ACTIF', paused: 'EN PAUSE', finished: 'TERMINÉ',
    live: 'EN DIRECT', offline: 'HORS LIGNE',
    systemGuide: 'Guide Système', replayDb: 'Rejouer Mission',
    runDemo: 'Lancer Simulation', deployFleet: 'Déployer FLOTTE (Temps Réel)',
    pause: 'Pause', resume: 'Reprendre',
    targetDetected: '⚠️ CIBLE DÉTECTÉE par le Scout !',
    rescueComplete: '✅ SAUVETAGE RÉUSSI — Mission Accomplie !',
    latency: 'Latence',
  },
  ar: {
    title: 'بوسيدون سرب',
    idle: 'خامل', active: 'نشط', paused: 'متوقف', finished: 'منتهي',
    live: 'مباشر', offline: 'غير متصل',
    systemGuide: 'دليل النظام', replayDb: 'إعادة المهمة',
    runDemo: 'تشغيل المحاكاة', deployFleet: 'نشر الأسطول (الوقت الفعلي)',
    pause: 'إيقاف مؤقت', resume: 'استئناف',
    targetDetected: '⚠️ تم اكتشاف الهدف!',
    rescueComplete: '✅ تم الإنقاذ بنجاح!',
    latency: 'زمن الاستجابة',
  }
}

const AGENT_LABELS = {
  scout_1: 'Scout Alpha',
  scout_2: 'Scout Bravo',
  spotter_1: 'Spotter One',
  rescuer_1: 'Rescuer One',
  rescuer_2: 'Rescuer Two'
}

function App() {
  const [missionState, setMissionState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [simSpeed, setSimSpeed] = useState(1.0)
  const [lastMissionConfig, setLastMissionConfig] = useState(null)
  const warnedBatteryAgents = useRef(new Set())
  const [soundMuted, setSoundMuted] = useState(false)
  
  // UI State
  const [showHistoryBrowser, setShowHistoryBrowser] = useState(false)
  const [showSystemGuide, setShowSystemGuide] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [expandedVideo, setExpandedVideo] = useState(false)
  const [sosLocation, setSosLocation] = useState([30.42, -10.00])
  const [replayHistory, setReplayHistory] = useState(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)
  
  // Theme & Language
  const [darkMode, setDarkMode] = useState(true)
  const [lang, setLang] = useState('en')
  const t = LANG[lang]
  
  // Connection Status
  const [wsLatency, setWsLatency] = useState(null)
  const lastMsgTime = useRef(Date.now())
  
  const wsRef = useRef(null)
  const prevStatusRef = useRef('idle')

  // Web Audio Context (lazy init)
  const audioCtx = useRef(null)

  // ── Theme Toggle ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume()
    }
  }

  const playSonarPing = useCallback(() => {
    if (soundMuted || !audioCtx.current) return
    const ctx = audioCtx.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
    
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5)
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.5)
  }, [soundMuted])

  const playAlertSound = useCallback((type) => {
    if (soundMuted || !audioCtx.current) return
    const ctx = audioCtx.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    if (type === 'critical') {
      osc.type = 'square'
      osc.frequency.value = 400
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.4)
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    } else if (type === 'success') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    }
    
    osc.connect(gain)
    gain.connect(ctx.destination)
  }, [soundMuted])

  // Toast helper
  const addToast = useCallback((message, priority = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, priority }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // WebSocket connection  
  useEffect(() => {
    let ws
    let reconnectTimer

    const connect = () => {
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        setConnected(true)
        wsRef.current = ws
      }

      ws.onmessage = (event) => {
        // Measure latency
        const now = Date.now()
        setWsLatency(now - lastMsgTime.current)
        lastMsgTime.current = now
        
        // If we are in replay mode, ignore live websocket data
        if (replayHistory) return

        const msg = JSON.parse(event.data)
        if (msg.type === 'state_update') {
          setMissionState(prev => {
            const newState = msg.data

            // Detect events by comparing with previous state
            if (prev) {
              if (!prev.stats.ttd && newState.stats.ttd) {
                addToast(t.targetDetected, 'critical')
                playAlertSound('critical')
              }
              if (!prev.stats.ttr && newState.stats.ttr) {
                addToast(t.rescueComplete, 'success')
                playAlertSound('success')
              }
              if (prev.mission_status !== 'finished' && newState.mission_status === 'finished') {
                setTimeout(() => setShowSummary(true), 1500)
              }
              Object.keys(newState.agents).forEach(agentId => {
                if (prev.agents[agentId]?.status !== newState.agents[agentId]?.status) {
                  const agent = newState.agents[agentId]
                  if (agent.status === 'pursuing') {
                    addToast(`🎯 ${agentId.replace('_', ' ').toUpperCase()} dispatched to intercept`, 'warning')
                  }
                }
              })
              // Battery warnings
              if (newState.agents) {
                Object.entries(newState.agents).forEach(([agentId, agent]) => {
                  if (agent.battery < 20 && !warnedBatteryAgents.current.has(agentId)) {
                    warnedBatteryAgents.current.add(agentId)
                    const label = AGENT_LABELS[agentId] || agentId.replace('_', ' ').toUpperCase()
                    addToast(`⚠️ ${label} battery critical (${agent.battery.toFixed(1)}%)`, 'critical')
                    playAlertSound('critical')
                  }
                })
              }
            }
            return newState
          })
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
      clearTimeout(reconnectTimer)
    }
  }, [addToast])

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKey = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      const status = missionState?.mission_status
      
      if (e.code === 'Space') {
        e.preventDefault()
        if (status === 'active') pauseMission()
        else if (status === 'paused') resumeMission()
      }
      if (e.code === 'Escape') {
        if (showSystemGuide) setShowSystemGuide(false)
        else if (showHistoryBrowser) setShowHistoryBrowser(false)
        else if (showConfigModal) setShowConfigModal(false)
        else if (showSummary) setShowSummary(false)
      }
      if (e.code === 'KeyG' && !e.ctrlKey) {
        if (status === 'idle' || !status) setShowSystemGuide(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [missionState, showSystemGuide, showHistoryBrowser, showConfigModal, showSummary])

  // API calls
  const startMission = async (difficulty, useLiveWeather) => {
    initAudio()
    // Open the config modal for both 'demo' and 'physical' modes
    setShowConfigModal(difficulty) // difficulty is either 'demo' or 'physical'
  }

  const launchMissionWithConfig = async (config) => {
    initAudio()
    playSonarPing()
    warnedBatteryAgents.current.clear()
    setSimSpeed(1.0)
    
    try {
      const payload = {
        // If mode is physical, force 'live' difficulty to use live weather
        difficulty: showConfigModal === 'physical' ? 'live' : (config.difficulty || 'medium'),
        use_live_weather: showConfigModal === 'physical',
        blind_search: config.blind_search || false,
        target_lat: config.target_lat || sosLocation[0],
        target_lng: config.target_lng || sosLocation[1]
      }
      setLastMissionConfig(payload)
      
      await fetch(`${API_URL}/api/mission/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      addToast(`Fleet deployed: ${config.drone_count || 2} scouts, ${config.spotter_count || 1} spotters, ${config.rescuer_count || 2} rescuers`, 'success')
    } catch (e) {
      addToast('Failed to connect to backend', 'critical')
    }
  }

  const changeSpeed = async (newSpeed) => {
    try {
      setSimSpeed(newSpeed)
      await fetch(`${API_URL}/api/mission/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: newSpeed })
      })
      addToast(`Simulation speed set to ${newSpeed}x`, 'info')
    } catch (e) {
      addToast('Failed to set simulation speed', 'critical')
    }
  }

  const handleRunAgain = async () => {
    if (lastMissionConfig) {
      setShowSummary(false)
      initAudio()
      playSonarPing()
      warnedBatteryAgents.current.clear()
      setSimSpeed(1.0)
      
      try {
        await fetch(`${API_URL}/api/mission/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastMissionConfig)
        })
        addToast('Mission re-launched with previous configuration', 'success')
      } catch (e) {
        addToast('Failed to connect to backend', 'critical')
      }
    }
  }

  const pauseMission = async () => {
    await fetch(`${API_URL}/api/mission/pause`, { method: 'POST' })
  }

  const resumeMission = async () => {
    await fetch(`${API_URL}/api/mission/resume`, { method: 'POST' })
  }

  const abortMission = async () => {
    setShowSummary(false)
    await fetch(`${API_URL}/api/mission/abort`, { method: 'POST' })
  }

  // --- REPLAY LOGIC ---
  const loadMissionReplay = async (missionId) => {
    try {
      addToast(`Loading Mission #${missionId} flight data...`, 'info')
      const res = await fetch(`${API_URL}/api/history/${missionId}`)
      const data = await res.json()
      if (data.history_json) {
        setReplayHistory(data.history_json)
        setReplayIndex(0)
        setMissionState(data.history_json[0])
        setShowHistoryBrowser(false)
        setShowSummary(false)
        addToast(`Mission loaded. Ready for playback.`, 'success')
      }
    } catch (e) {
      addToast('Failed to load mission replay', 'critical')
    }
  }

  const exitReplayMode = () => {
    setReplayHistory(null)
    setReplayPlaying(false)
    setMissionState(null)
    addToast('Exited Replay Mode. Back to live telemetry.', 'info')
  }

  useEffect(() => {
    let interval
    if (replayHistory && replayPlaying) {
      interval = setInterval(() => {
        setReplayIndex(prev => {
          const next = prev + 1
          if (next >= replayHistory.length) {
            setReplayPlaying(false)
            return prev
          }
          setMissionState(replayHistory[next])
          return next
        })
      }, 500)
    }
    return () => clearInterval(interval)
  }, [replayHistory, replayPlaying])

  const handleScrub = (idx) => {
    if (replayHistory) {
      setReplayIndex(idx)
      setMissionState(replayHistory[idx])
    }
  }
  // ----------------------

  return (
    <div className={`app-layout ${!darkMode ? 'light-theme' : ''}`}>
      <MissionControl
        state={missionState}
        connected={connected && !replayHistory}
        onStart={startMission}
        onPause={pauseMission}
        onResume={resumeMission}
        onAbort={abortMission}
        onOpenHistory={() => setShowHistoryBrowser(true)}
        onOpenGuide={() => setShowSystemGuide(true)}
        lang={lang}
        t={t}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
        onChangeLang={setLang}
        wsLatency={wsLatency}
        speed={simSpeed}
        onChangeSpeed={changeSpeed}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
      />

      <div className="main-content">
        <div className="panel panel-weather">
          <WeatherPanel weather={missionState?.weather} />
        </div>

        <div className={`panel panel-map ${missionState?.stats?.ttd ? 'glow-critical' : missionState?.mission_status === 'active' ? 'glow-active' : ''}`}>
          <TacticalMap
            agents={missionState?.agents}
            piw={missionState?.piw}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            sosLocation={sosLocation}
            setSosLocation={setSosLocation}
            isIdle={!missionState || missionState.mission_status === 'idle'}
            driftTrajectory={missionState?.drift_trajectory}
            gridCenter={missionState?.grid_center}
          />
        </div>

        <div className={`panel panel-telemetry ${missionState?.mission_status === 'active' ? 'glow-active' : ''}`}>
          <Telemetry
            stats={missionState?.stats}
            agents={missionState?.agents}
            missionStatus={missionState?.mission_status}
            timeStep={missionState?.time_step}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        </div>

        <div className={`panel panel-video ${missionState?.stats?.ttd ? 'glow-critical' : ''}`}>
          <VideoFeed
            selectedAgentId={selectedAgent}
            agents={missionState?.agents}
            piw={missionState?.piw}
            onExpand={() => setExpandedVideo(true)}
          />
        </div>

        <div className="panel panel-commlink">
          {replayHistory && (
            <TimelineScrubber 
              historyLength={replayHistory.length}
              currentIndex={replayIndex}
              onIndexChange={handleScrub}
              isPlaying={replayPlaying}
              onTogglePlay={() => setReplayPlaying(!replayPlaying)}
              onExit={exitReplayMode}
            />
          )}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CommLink logs={missionState?.logs} />
          </div>
        </div>
        
        {/* AI Decision Panel (bottom-right corner overlay) */}
        {missionState && missionState.mission_status === 'active' && (
          <div className="panel panel-ai-decisions">
            <AIDecisionPanel
              logs={missionState?.logs}
              agents={missionState?.agents}
              selectedAgent={selectedAgent}
            />
          </div>
        )}
      </div>

      <AlertSystem toasts={toasts} />

      {showHistoryBrowser && (
        <HistoryBrowser 
          apiUrl={API_URL}
          onClose={() => setShowHistoryBrowser(false)}
          onSelectMission={loadMissionReplay}
        />
      )}

      {showSystemGuide && (
        <GuidedTour onClose={() => setShowSystemGuide(false)} lang={lang} t={t} />
      )}

      {showConfigModal && (
        <MissionConfigModal
          sosLocation={sosLocation}
          onClose={() => setShowConfigModal(false)}
          onConfirm={launchMissionWithConfig}
          mode={showConfigModal}
        />
      )}

      {showSummary && missionState && !replayHistory && (
        <MissionSummary
          stats={missionState.stats}
          weather={missionState.weather}
          difficulty={missionState.difficulty}
          agents={missionState.agents}
          onRunAgain={lastMissionConfig ? handleRunAgain : null}
          onClose={() => setShowSummary(false)}
        />
      )}

      {expandedVideo && (
        <div className="video-modal-overlay" onClick={() => setExpandedVideo(false)}>
          <div className="video-modal-content" onClick={e => e.stopPropagation()}>
            <button className="video-modal-close" onClick={() => setExpandedVideo(false)}>✕ CLOSE</button>
            <VideoFeed
              selectedAgentId={selectedAgent}
              agents={missionState?.agents}
              piw={missionState?.piw}
              isExpanded={true}
            />
          </div>
        </div>
      )}

      {!connected && !replayHistory && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 10, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          gap: 16
        }}>
          <div className="sos-pulse-marker" style={{ width: 48, height: 48, position: 'relative', margin: '0 auto' }}></div>
          <h3 style={{ color: 'var(--cyan-300)', fontWeight: 600, letterSpacing: '1px', fontSize: '16px', marginTop: '10px' }}>ESTABLISHING SWARM UPLINK...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Connecting to Poseidon AI Simulation Engine on port 8000</p>
        </div>
      )}
    </div>
  )
}

export default App
