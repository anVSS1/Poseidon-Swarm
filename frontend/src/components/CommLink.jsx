import { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'

export default function CommLink({ logs }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <>
      <div className="panel-header">
        <Terminal className="icon" />
        SWARM COMM-LINK
      </div>
      <div className="panel-body comm-link">
        {(!logs || logs.length === 0) && (
          <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11 }}>
            Awaiting mission start...
          </div>
        )}
        {logs && logs.map((log, i) => {
          const isLast = i === logs.length - 1;
          return (
            <div key={i} className="log-entry">
              <span className="log-timestamp">{log.timestamp}</span>
              <span className={`log-source ${log.source}`}>
                [{log.source.replace('_', '-').toUpperCase()}]
              </span>
              <span className={`log-message ${log.priority} ${isLast ? 'typewriter-text' : ''}`} style={{ display: isLast ? 'inline-block' : 'inline' }}>
                {log.message}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </>
  )
}
