import { useState, useEffect } from 'react'
import { Video, VideoOff, Crosshair, Maximize } from 'lucide-react'

export default function VideoFeed({ selectedAgentId, agents, piw, onExpand, isExpanded }) {
  const [glitch, setGlitch] = useState(false)

  const agent = selectedAgentId && agents ? agents[selectedAgentId] : null
  const hasFeed = !!agent
  const isTracking = hasFeed && piw && piw.status !== 'drifting'
  
  // Random small glitches for realism
  useEffect(() => {
    if (!hasFeed) return
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setGlitch(true)
        setTimeout(() => setGlitch(false), 150)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [hasFeed])

  // Calculate local coordinates for the bounding box
  // If agent detects PIW, put box in center.
  // Otherwise, wander the box slightly.
  let boxStyle = { opacity: 0 }
  if (hasFeed) {
    if (isTracking) {
      // YOLO BOUNDING BOX!
      // In a real system, would be pixel coords from ONNX. Here, synthetic target lock.
      boxStyle = {
        opacity: 1,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '120px',
        height: '120px',
        borderColor: '#10b981', // green target lock
        boxShadow: '0 0 10px rgba(16, 185, 129, 0.5), inset 0 0 10px rgba(16, 185, 129, 0.5)',
        transition: 'all 0.2s ease-out'
      }
      
      // Add slight shake since drones shake
      if (Math.random() > 0.5) {
        boxStyle.transform = `translate(calc(-50% + ${Math.random()*4-2}px), calc(-50% + ${Math.random()*4-2}px))`
      }
    }
  }

  return (
    <>
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Video className="icon" />
          {hasFeed ? `CAM: ${selectedAgentId.toUpperCase()}` : 'DRONE CAMERA FEED'}
        </div>
        {!isExpanded && onExpand && (
          <button onClick={onExpand} style={{ background: 'none', border: 'none', color: 'var(--cyan-400)', cursor: 'pointer', display: 'flex' }} title="Expand Video">
            <Maximize size={16} />
          </button>
        )}
      </div>
      <div className="panel-body" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
        
        {/* Synthetic "Video" background gradient that changes based on agent altitude */}
        <div 
          className="video-feed-container" 
          style={{ 
            background: hasFeed ? `radial-gradient(ellipse at center, #111827 0%, #000000 100%)` : 'var(--bg-deep)',
            filter: glitch ? 'hue-rotate(90deg) contrast(150%)' : 'none',
          }}
        >
          {!hasFeed ? (
            <div className="no-feed">
              <VideoOff className="icon" />
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>
                No active feed
              </div>
              <div style={{ fontSize: 10, marginTop: 2, color: 'var(--text-muted)' }}>
                Select an agent on the map to view FLIR camera
              </div>
            </div>
          ) : (
            <div className="synthetic-feed">
              {/* Synthetic FLIR Thermal Overlay */}
              <div className="flir-overlay" style={{
                position: 'absolute', inset: 0, opacity: 0.1,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, #10b981 1px, transparent 2px)',
                backgroundSize: '100% 4px'
              }} />
              
              {/* Telemetry HUD */}
              <div style={{ position: 'absolute', top: 10, left: 10, fontFamily: 'monospace', fontSize: 10, color: '#10b981' }}>
                <div>ALT: {(120 + Math.random()*2).toFixed(1)}m</div>
                <div>SPD: {(agent.battery * 0.4).toFixed(1)}kn</div>
                <div>HDG: {agent.heading.toFixed(0)}&deg;</div>
              </div>
              
              <div style={{ position: 'absolute', bottom: 10, right: 10, fontFamily: 'monospace', fontSize: 10, color: '#10b981', textAlign: 'right' }}>
                <div>LAT: {agent.lat.toFixed(5)}</div>
                <div>LNG: {agent.lng.toFixed(5)}</div>
                <div>BAT: {agent.battery.toFixed(0)}%</div>
              </div>
              
              {/* Center Crosshair */}
              <Crosshair style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(16, 185, 129, 0.4)', width: 40, height: 40 }} />
              
              {/* YOLO Bounding Box */}
              <div style={{
                position: 'absolute',
                border: '2px solid #ef4444',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.5), inset 0 0 10px rgba(239, 68, 68, 0.5)',
                pointerEvents: 'none',
                ...boxStyle
              }}>
                <div style={{ 
                  position: 'absolute', top: -18, left: -2, background: boxStyle.borderColor || '#ef4444', 
                  color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 4px', fontFamily: 'monospace' 
                }}>
                  PERSON_IN_WATER {(0.85 + Math.random()*0.12).toFixed(2)}
                </div>
              </div>
              
              {/* Noise grain */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.05,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'
              }}/>
            </div>
          )}
          {/* CRT scanline overlay */}
          <div className="scanlines" />
        </div>
      </div>
    </>
  )
}
