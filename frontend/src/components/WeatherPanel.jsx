import { Wind, Waves, Navigation } from 'lucide-react'

export default function WeatherPanel({ weather }) {
  const windDir = weather?.wind_dir || 0

  return (
    <>
      <div className="panel-header">
        <Waves className="icon" />
        ENVIRONMENT
      </div>
      <div className="panel-body">
        {/* Wind */}
        <div className="weather-gauge">
          <div className="gauge-label"><Wind size={10} /> Wind Speed</div>
          <div className="gauge-value">
            {weather?.wind_speed?.toFixed(1) || '0.0'}
            <span className="gauge-unit"> m/s</span>
          </div>
        </div>

        {/* Wind Compass */}
        <div className="weather-gauge">
          <div className="gauge-label">Wind Direction</div>
          <div className="wind-compass">
            <div className="arrow" style={{ transform: `rotate(${windDir}deg)` }} />
            <span style={{ 
              position: 'absolute', 
              top: -2, 
              fontSize: 8, 
              color: 'var(--text-dim)',
              fontWeight: 600 
            }}>N</span>
            <span style={{ 
              position: 'absolute', 
              right: -2, 
              fontSize: 8, 
              color: 'var(--text-dim)',
              fontWeight: 600 
            }}>E</span>
            <span style={{ 
              position: 'absolute', 
              bottom: -2, 
              fontSize: 8, 
              color: 'var(--text-dim)',
              fontWeight: 600 
            }}>S</span>
            <span style={{ 
              position: 'absolute', 
              left: -2, 
              fontSize: 8, 
              color: 'var(--text-dim)',
              fontWeight: 600 
            }}>W</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {windDir}°
          </div>
        </div>

        {/* Wave Height */}
        <div className="weather-gauge">
          <div className="gauge-label"><Waves size={10} /> Wave Height</div>
          <div className="gauge-value">
            {weather?.wave_height?.toFixed(2) || '0.00'}
            <span className="gauge-unit"> m</span>
          </div>
        </div>

        {/* Current */}
        <div className="weather-gauge">
          <div className="gauge-label"><Navigation size={10} /> Current Speed</div>
          <div className="gauge-value">
            {weather?.current_speed?.toFixed(2) || '0.00'}
            <span className="gauge-unit"> m/s</span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="weather-gauge" style={{ 
          borderColor: weather?.difficulty_label === 'Storm Conditions' 
            ? 'rgba(239, 68, 68, 0.3)' 
            : 'var(--border-subtle)' 
        }}>
          <div className="gauge-label">Conditions</div>
          <div style={{ 
            fontSize: 13, 
            fontWeight: 600, 
            color: weather?.difficulty_label === 'Storm Conditions' 
              ? 'var(--danger)' 
              : weather?.difficulty_label === 'Choppy Waters'
                ? 'var(--warning)'
                : 'var(--success)',
            marginTop: 4
          }}>
            {weather?.difficulty_label || '—'}
          </div>
        </div>
      </div>
    </>
  )
}
