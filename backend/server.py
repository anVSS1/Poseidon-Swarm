import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from simulation import SimulationManager
from database import get_recent_missions, get_mission_by_id

app = FastAPI(title="Poseidon-Swarm API")

# Enable CORS for the React frontend — no credentials needed (no auth cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

sim = SimulationManager()

# --- REST Models ---
class MissionConfig(BaseModel):
    difficulty: str = Field("medium", pattern="^(easy|medium|hard|live|calm|choppy|storm)$")
    use_live_weather: bool = False
    target_lat: float = Field(30.42, ge=-90.0, le=90.0)
    target_lng: float = Field(-10.00, ge=-180.0, le=180.0)
    blind_search: bool = False
    
# --- REST Endpoints ---
@app.get("/")
def health_check():
    return {"status": "Poseidon Backend Running"}

@app.get("/api/mission/state")
def get_mission_state():
    """Snapshot of current mission state (for debugging without WebSocket)."""
    state = sim.state
    agents = state.get("agents", {})
    return {
        "mission_status": state.get("mission_status"),
        "time_step": state.get("time_step"),
        "agents": agents,
        "piw": state.get("piw", {}),
        "grid_center": state.get("grid_center", {}),
        "stats": state.get("stats", {}),
        "logs": state.get("logs", [])[-10:]
    }

@app.post("/api/mission/start")
async def start_mission(config: MissionConfig):
    await sim.start_mission(config.model_dump())
    return {"status": "success", "difficulty": config.difficulty}

@app.post("/api/mission/pause")
async def pause_mission():
    await sim.pause_mission()
    return {"status": "paused"}

@app.post("/api/mission/resume")
async def resume_mission():
    await sim.resume_mission()
    return {"status": "resumed"}

@app.post("/api/mission/abort")
async def abort_mission():
    await sim.abort_mission()
    return {"status": "aborted"}

class SpeedConfig(BaseModel):
    speed: float = Field(1.0, ge=0.5, le=4.0)

@app.post("/api/mission/speed")
async def set_speed(config: SpeedConfig):
    sim.speed_multiplier = config.speed
    return {"status": "ok", "speed": config.speed}

@app.get("/api/history")
def get_history():
    """Returns a list of past missions."""
    return {"missions": get_recent_missions(10)}

@app.get("/api/history/{mission_id}")
def get_mission_replay(mission_id: int):
    """Returns the heavy history payload for mission replay UI."""
    mission = get_mission_by_id(mission_id)
    if mission:
        return mission
    raise HTTPException(status_code=404, detail="Mission not found")

# --- Websocket Endpoint ---
MAX_WS_CONNECTIONS = 10  # Limit concurrent WebSocket connections

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    if len(sim.clients) >= MAX_WS_CONNECTIONS:
        await websocket.close(code=1013, reason="Too many connections")
        return
    await websocket.accept()
    await sim.add_client(websocket)
    try:
        while True:
            # Listening for client commands over WS if any (like speed slider updates)
            data = await websocket.receive_text()
            # Don't log raw user input to prevent log injection
    except WebSocketDisconnect:
        sim.remove_client(websocket)

if __name__ == "__main__":
    print("[Poseidon Backend] Starting Server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
