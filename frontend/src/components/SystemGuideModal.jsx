import { X, Map, Video, Activity, Radio, Cpu, Navigation, Eye } from 'lucide-react'

export default function SystemGuideModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 800 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan-400)', marginBottom: 20 }}>
          <Cpu size={24} /> Poseidon-Swarm Architecture Guide
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          
          {/* Map Panel Info */}
          <div style={{ background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, color: 'var(--text-primary)' }}>
              <Map size={18} color="var(--cyan-500)" /> Tactical Map
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The central geographic command interface. It renders live GPS coordinates of the fleet. 
              <br/><br/>
              <b>AI Integration:</b> Blue/Yellow drones sweep the area using a PyTorch <b>Multi-Agent PPO (MAPPO)</b> policy. 
              When target is found, Red Rescuer boats intercept the target using the <b>ONNX Drift Predictor</b> to chase the future predicted drift location.
            </p>
          </div>

          {/* Video Panel Info */}
          <div style={{ background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, color: 'var(--text-primary)' }}>
              <Video size={18} color="var(--warning)" /> Synthetic Video Feed
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Simulates the drone camera payload. 
              <br/><br/>
              <b>AI Integration:</b> In the backend, this correlates with the <b>YOLO PyTorch</b> computer vision model. When the drone flies near the victim, the backend natively executes YOLO inference, and this UI simulates the visual "Lock-On" confirmation.
            </p>
          </div>

          {/* Telemetry Panel Info */}
          <div style={{ background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, color: 'var(--text-primary)' }}>
              <Activity size={18} color="var(--success)" /> Fleet Telemetry
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Live hardware stats for all deployed agents. 
              <br/><br/>
              <b>Future Work:</b> This panel is designed to ingest <b>MAVLink</b> (drones) and <b>AIS</b> (boats) packets over encrypted WebSockets to display physical battery, heading, and altitude for physical hardware deployments.
            </p>
          </div>

          {/* Comm-Link Info */}
          <div style={{ background: 'var(--bg-deep)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, color: 'var(--text-primary)' }}>
              <Radio size={18} color="var(--danger)" /> Comm-Link Terminal
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The raw log output of the Python FastAPI backend engine. 
              <br/><br/>
              Watch this terminal to see the exact moment the <b>Open-Meteo Live API</b> is queried for weather, or when the <b>Drift ONNX</b> model outputs its mathematical prediction matrix.
            </p>
          </div>

        </div>

        <div style={{ marginTop: 20, padding: 16, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--cyan-700)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--cyan-400)' }}>How to run a Demo:</h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <li><b>Deploy FLEET (Live RT):</b> Connects to physical drone hardware APIs (fails gracefully if no drones are found).</li>
            <li><b>Run System Demo:</b> Executes the Python AI backend natively but simulates the drone physics, proving the AI logic works.</li>
            <li><b>Replay DB:</b> Loads a historical mission from the SQLite Flight Data Recorder for a flawless presentation playback.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
