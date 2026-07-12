import React from 'react'

export default function MissionChart({ missions }) {
  if (!missions || missions.length === 0) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No data for chart</div>
  }

  // Take up to last 8 or 10 missions so it doesn't get crowded
  const chartMissions = [...missions].reverse().slice(-8)

  const width = 520
  const height = 260
  const paddingLeft = 50
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 45

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Extract times in seconds. Each tick is 0.5s.
  const data = chartMissions.map(m => {
    const ttd = m.final_stats?.ttd ? m.final_stats.ttd * 0.5 : 0
    const ttr = m.final_stats?.ttr ? m.final_stats.ttr * 0.5 : 0
    return {
      id: m.id,
      label: `#${m.id}`,
      ttd,
      ttr,
      success: !!m.final_stats?.ttr,
    }
  })

  // Find max time to scale Y axis. Minimum max is 60s to prevent division by zero or weird scales.
  const maxVal = Math.max(...data.map(d => Math.max(d.ttd, d.ttr)), 60)
  // Round maxVal up to a nice multiple of 30 or 60
  const yMax = Math.ceil(maxVal / 60) * 60

  const getX = (index) => paddingLeft + (index * (chartWidth / data.length))
  const getY = (value) => height - paddingBottom - (value / yMax * chartHeight)

  const barWidth = Math.max(6, (chartWidth / data.length) / 3.5)

  // Y-axis grid lines (e.g. 4 divisions)
  const yTicks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]

  return (
    <div className="mission-chart-container" style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#22d3ee', borderRadius: 2 }} />
          <span>Time to Detect (TTD)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#10b981', borderRadius: 2 }} />
          <span>Time to Rescue (TTR)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#ef4444', borderRadius: 2 }} />
          <span>Failed Mission</span>
        </div>
      </div>

      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Y Axis Grid Lines */}
        {yTicks.map((yVal, i) => {
          const y = getY(yVal)
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border-subtle)"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}
              >
                {Math.round(yVal)}s
              </text>
            </g>
          )
        })}

        {/* X Axis base line */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="var(--border-default)"
        />

        {/* Bars */}
        {data.map((d, index) => {
          const groupX = getX(index)
          const stepWidth = chartWidth / data.length
          const centerX = groupX + stepWidth / 2

          // TTD Bar
          const ttdHeight = (d.ttd / yMax) * chartHeight
          const ttdX = centerX - barWidth - 2
          const ttdY = height - paddingBottom - ttdHeight

          // TTR Bar (or red error bar if failed)
          const ttrHeight = d.success ? (d.ttr / yMax) * chartHeight : 15 // minimum height for failed marker
          const ttrX = centerX + 2
          const ttrY = height - paddingBottom - ttrHeight

          return (
            <g key={d.id}>
              {/* TTD Bar */}
              <rect
                x={ttdX}
                y={ttdY}
                width={barWidth}
                height={ttdHeight}
                fill="#22d3ee"
                rx={1}
              >
                <title>{`TTD: ${d.ttd}s`}</title>
              </rect>
              
              {/* TTR or Failed Bar */}
              <rect
                x={ttrX}
                y={ttrY}
                width={barWidth}
                height={ttrHeight}
                fill={d.success ? '#10b981' : '#ef4444'}
                rx={1}
              >
                <title>{d.success ? `TTR: ${d.ttr}s` : 'Failed'}</title>
              </rect>

              {/* X Axis Label */}
              <text
                x={centerX}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fill="var(--text-primary)"
                style={{ fontSize: 10, fontWeight: 500 }}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
