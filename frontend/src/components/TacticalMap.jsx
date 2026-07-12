import { useEffect, useRef, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, Rectangle, useMap, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import { Map as MapIcon } from 'lucide-react'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
})

const AGENT_EMOJI = {
  scout: '🛸',
  spotter: '🔍',
  rescuer: '🚤'
}

const AGENT_COLORS = {
  scout: '#22d3ee',
  spotter: '#fbbf24',
  rescuer: '#f87171'
}

const STATUS_LABELS = {
  idle: 'STANDBY',
  searching: 'SEARCHING',
  pursuing: 'PURSUING',
  rescuing: 'RESCUING',
  returning: 'RTB'
}

function createAgentIcon(type) {
  return L.divIcon({
    className: '',
    html: `<div class="agent-marker ${type}">
      <span style="font-size:16px">${AGENT_EMOJI[type]}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

function createPIWIcon(status) {
  const color = status === 'rescued' ? '#10b981' : status === 'detected' ? '#ef4444' : '#a78bfa'
  return L.divIcon({
    className: '',
    html: `<div class="piw-marker" style="background:${color}; ${status === 'detected' ? 'animation:pulse-piw 0.6s infinite' : ''}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

function FixMapRender() {
  const map = useMap()
  useEffect(() => {
    // Force Leaflet to recalculate its container size (fixes blank gray map bug on load)
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 250)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

function MapUpdater({ agents, piw }) {
  const map = useMap()
  const hasFlown = useRef(false)
  
  useEffect(() => {
    // Force Leaflet to recalculate its container size (fixes blank gray map bug)
    setTimeout(() => {
      map.invalidateSize()
    }, 200)

    if (agents && !hasFlown.current) {
      const allPoints = Object.values(agents).map(a => [a.lat, a.lng])
      if (piw) allPoints.push([piw.lat, piw.lng])
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds.pad(0.3), { maxZoom: 15, duration: 1.5 })
        hasFlown.current = true
      }
    }
  }, [agents, piw, map])
  
  return null
}

function ClickHandler({ setSosLocation, isIdle }) {
  useMapEvents({
    click: (e) => {
      if (isIdle) {
        setSosLocation([e.latlng.lat, e.latlng.lng])
      }
    }
  })
  return null
}

const sosIcon = L.divIcon({
  className: '',
  html: '<div class="sos-pulse-marker"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
})

export default function TacticalMap({ agents, piw, selectedAgent, onSelectAgent, sosLocation, setSosLocation, isIdle, driftTrajectory, gridCenter }) {
  const defaultCenter = [30.42, -10.00] // Agadir open ocean
  const [showHeatmap, setShowHeatmap] = useState(false)

  const agentIcons = useMemo(() => ({
    scout: createAgentIcon('scout'),
    spotter: createAgentIcon('spotter'),
    rescuer: createAgentIcon('rescuer'),
  }), [])

  const piwIcon = useMemo(() => createPIWIcon(piw?.status), [piw?.status])

  return (
    <>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapIcon className="icon" />
          TACTICAL MAP
        </div>
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`btn btn-sm ${showHeatmap ? 'btn-primary' : ''}`}
          style={{ padding: '2px 8px', fontSize: 10, height: '22px' }}
        >
          🔥 Heatmap
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative', height: '100%', minHeight: 400 }}>
        <MapContainer
          center={defaultCenter}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <FixMapRender />
          <ClickHandler setSosLocation={setSosLocation} isIdle={isIdle} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* SOS Ping Marker (Only visible when idle) */}
          {isIdle && sosLocation && (
            <Marker position={sosLocation} icon={sosIcon}>
              <Tooltip permanent direction="top" className="sos-tooltip">
                SOS Distress Location
              </Tooltip>
            </Marker>
          )}

          <MapUpdater agents={agents} piw={piw} />

          {/* Heatmap overlay vs normal agent trail paths */}
          {showHeatmap ? (
            agents && Object.entries(agents).map(([id, agent]) => (
              agent.trail && agent.trail.map((p, idx) => (
                <CircleMarker
                  key={`heat-${id}-${idx}`}
                  center={[p.lat, p.lng]}
                  radius={14}
                  pathOptions={{
                    stroke: false,
                    fillColor: '#f97316',
                    fillOpacity: 0.12
                  }}
                />
              ))
            ))
          ) : (
            agents && Object.entries(agents).map(([id, agent]) => (
              agent.trail && agent.trail.length > 1 && (
                <Polyline
                  key={`trail-${id}`}
                  positions={agent.trail.map(p => [p.lat, p.lng])}
                  pathOptions={{
                    color: AGENT_COLORS[agent.type],
                    weight: id === selectedAgent ? 3 : 1.5,
                    opacity: id === selectedAgent ? 0.6 : 0.3,
                    dashArray: '4, 6'
                  }}
                />
              )
            ))
          )}

          {/* Intercept predicted paths for rescuers */}
          {agents && Object.entries(agents).map(([id, agent]) => (
            agent.target_lat && agent.target_lng && (
              <Polyline
                key={`intercept-${id}`}
                positions={[[agent.lat, agent.lng], [agent.target_lat, agent.target_lng]]}
                pathOptions={{
                  color: '#ef4444',
                  weight: 2,
                  dashArray: '4, 4',
                  opacity: 0.8
                }}
              />
            )
          ))}

          {/* Render agent markers */}
          {agents && Object.entries(agents).map(([id, agent]) => (
            <Marker
              key={id}
              position={[agent.lat, agent.lng]}
              icon={agentIcons[agent.type]}
              eventHandlers={{
                click: () => onSelectAgent(id)
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.6, minWidth: 140 }}>
                  <strong style={{ fontSize: 13 }}>{id.replace('_', ' ').toUpperCase()}</strong><br />
                  <span style={{ color: '#888' }}>Status:</span> <strong>{STATUS_LABELS[agent.status] || agent.status}</strong><br />
                  <span style={{ color: '#888' }}>Battery:</span> {agent.battery.toFixed(1)}%<br />
                  <span style={{ color: '#888' }}>Heading:</span> {agent.heading.toFixed(0)}°<br />
                  <span style={{ color: '#888' }}>Pos:</span> {agent.lat.toFixed(4)}, {agent.lng.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* PIW drift trail (purple dotted line showing where person drifted) */}
          {piw && piw.drift_points && piw.drift_points.length > 1 && (
            <Polyline
              positions={piw.drift_points.map(p => [p.lat, p.lng])}
              pathOptions={{
                color: '#a78bfa',
                dashArray: '6, 8',
                weight: 2,
                opacity: 0.5
              }}
            />
          )}

          {/* PIW Marker */}
          {piw && piw.lat !== 0 && (
            <Marker
              position={[piw.lat, piw.lng]}
              icon={piwIcon}
            >
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.6 }}>
                  <strong>👤 PERSON IN WATER</strong><br />
                  <span style={{ color: '#888' }}>Status:</span> <strong style={{
                    color: piw.status === 'rescued' ? '#10b981' : piw.status === 'detected' ? '#ef4444' : '#a78bfa'
                  }}>{piw.status.toUpperCase()}</strong><br />
                  <span style={{ color: '#888' }}>Pos:</span> {piw.lat.toFixed(4)}, {piw.lng.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Drift Trajectory Prediction (ONNX output visualization) */}
          {driftTrajectory && driftTrajectory.length > 1 && (
            <>
              <Polyline
                positions={driftTrajectory.map(p => [p.lat, p.lng])}
                pathOptions={{
                  color: '#f59e0b',
                  weight: 3,
                  dashArray: '8, 6',
                  opacity: 0.8
                }}
              />
              {driftTrajectory.slice(1).map((p, i) => (
                <CircleMarker
                  key={`drift-${i}`}
                  center={[p.lat, p.lng]}
                  radius={4}
                  pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 1 }}
                >
                  <Tooltip permanent direction="right" className="drift-tooltip">
                    {p.label}
                  </Tooltip>
                </CircleMarker>
              ))}
            </>
          )}

          {/* Search Grid Overlay (30x30 RL grid visualization) */}
          {gridCenter && (
            <>
              {/* Radar range sweeps */}
              <Circle
                center={[gridCenter.lat, gridCenter.lng]}
                radius={800}
                pathOptions={{
                  color: 'var(--cyan-accent)',
                  weight: 1,
                  fill: true,
                  fillColor: 'var(--cyan-accent)',
                  fillOpacity: 0.02,
                  className: 'radar-ring-1'
                }}
              />
              <Circle
                center={[gridCenter.lat, gridCenter.lng]}
                radius={1600}
                pathOptions={{
                  color: 'var(--cyan-accent)',
                  weight: 0.75,
                  fill: false,
                  dashArray: '10, 15',
                  className: 'radar-ring-2'
                }}
              />
              <Circle
                center={[gridCenter.lat, gridCenter.lng]}
                radius={2400}
                pathOptions={{
                  color: 'var(--cyan-accent)',
                  weight: 0.5,
                  fill: false,
                  dashArray: '5, 20',
                  className: 'radar-ring-3'
                }}
              />
              <Rectangle
                bounds={[
                  [gridCenter.lat - 0.015, gridCenter.lng - 0.018],
                  [gridCenter.lat + 0.015, gridCenter.lng + 0.018]
                ]}
                pathOptions={{
                  color: 'rgba(34, 211, 238, 0.3)',
                  weight: 1,
                  fillColor: 'rgba(34, 211, 238, 0.03)',
                  fillOpacity: 1,
                  dashArray: '6, 4'
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </>
  )
}
