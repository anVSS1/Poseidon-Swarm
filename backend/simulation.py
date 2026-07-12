import asyncio
import json
import math
import random
import time
import os
import sys
from typing import Dict, Any, List, Optional

import numpy as np
import onnxruntime as ort

from weather_service import WeatherService
from rl_inference import SwarmInference
import database
from global_land_mask import globe
from ultralytics import YOLO
import cv2
import torch

if not torch.cuda.is_available():
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)

# ═══════════════════════════════════════════════════════
#  POSEIDON SAR SIMULATION ENGINE — PRODUCTION
#  Uses REAL trained RL policies + REAL Drift ONNX model
# ═══════════════════════════════════════════════════════

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

# Direction vectors matching MAPPO v2 training: _RAW_DIRS = {0:[0,1], 1:[1,1], 2:[1,0], 3:[1,-1], 4:[0,-1], 5:[-1,-1], 6:[-1,0], 7:[-1,1], 8:[0,0]}
# Format: (dx, dy) where x=East, y=North — normalized for diagonals
DIRECTION_VECTORS = {
    0: (0.0, 1.0),       # N
    1: (0.707, 0.707),   # NE
    2: (1.0, 0.0),       # E
    3: (0.707, -0.707),  # SE
    4: (0.0, -1.0),      # S
    5: (-0.707, -0.707), # SW
    6: (-1.0, 0.0),      # W
    7: (-0.707, 0.707),  # NW
    8: (0.0, 0.0),       # Stay
}

DIRECTION_NAMES = {
    0: "N", 1: "NE", 2: "E", 3: "SE", 4: "S",
    5: "SW", 6: "W", 7: "NW", 8: "HOLD"
}

DEG_PER_KM = 0.009
GRID_SIZE = 30  # 30x30 grid (matches RL training env)


class Agent:
    """A single drone or rescue boat."""
    def __init__(self, agent_id: str, agent_type: str, lat: float, lng: float):
        self.id = agent_id
        self.type = agent_type
        self.lat = lat
        self.lng = lng
        self.battery = 100.0
        self.status = "idle"  # All agents start idle, transit phase sets proper status
        self.heading = 0
        self.trail = []
        self.target_lat = None
        self.target_lng = None
        self.observation = [0.0] * 35

        self.speed = {"scout": 0.0006, "spotter": 0.0004, "rescuer": 0.0003}[agent_type]
        # Detection radius — proportional to training env (5 cells / 30 grid = 1/6 of search area)
        # Scout: ~1.1km (drone camera at 100m altitude covers wide strip)
        # Spotter: ~770m (telephoto lens, tighter FOV)
        # Rescuer: ~330m (close-range visual only)
        self.detection_radius = {"scout": 0.010, "spotter": 0.007, "rescuer": 0.003}[agent_type]

    def apply_action(self, action: int):
        """
        Applies a compass action (0-8) from the RL policy.
        Land check ONLY applies here — the RL search pattern must not go inland.
        If the chosen action is blocked by land, we try the next best direction
        toward open water before giving up.
        """
        dx, dy = DIRECTION_VECTORS[action]
        new_lat = self.lat + dy * self.speed
        new_lng = self.lng + dx * self.speed

        if not globe.is_land(new_lat, new_lng):
            self.lat = new_lat
            self.lng = new_lng
            if action != 8:  # 8 = Stay, don't update heading
                self.heading = math.degrees(math.atan2(dx, dy)) % 360
        else:
            # Fallback: try each of the 8 directions and take the first that's water
            moved = False
            for fallback_action in [1, 3, 5, 7, 2, 4, 6, 8]:  # N, E, S, W first
                fdx, fdy = DIRECTION_VECTORS[fallback_action]
                flng = self.lng + fdx * self.speed
                flat = self.lat + fdy * self.speed
                if not globe.is_land(flat, flng):
                    self.lat = flat
                    self.lng = flng
                    self.heading = math.degrees(math.atan2(fdx, fdy)) % 360
                    moved = True
                    break
            # If every direction is land, stay put (extremely rare edge case)

        self.battery = max(0, self.battery - 0.06)
        self.trail.append({"lat": round(self.lat, 6), "lng": round(self.lng, 6)})
        if len(self.trail) > 200:
            self.trail.pop(0)

    def move_toward(self, target_lat: float, target_lng: float):
        """
        Direct autopilot movement toward a coordinate.
        NO land check — drones are UAVs flying at altitude over the coastline.
        In real deployment the drone's onboard flight controller (DJI/ArduPilot)
        handles physical terrain avoidance. Our backend just sets the waypoint.
        This is intentional: a drone transiting from a coast guard base to an ocean
        SOS must be allowed to fly over the coastal strip.
        """
        dlat = target_lat - self.lat
        dlng = target_lng - self.lng
        dist = math.sqrt(dlat**2 + dlng**2)

        if dist < self.speed * 0.5:
            new_lat, new_lng = target_lat, target_lng
        else:
            new_lat = self.lat + (dlat / dist) * self.speed
            new_lng = self.lng + (dlng / dist) * self.speed

        # Always move — no land check during transit/pursuit
        self.lat = new_lat
        self.lng = new_lng
        self.heading = math.degrees(math.atan2(dlng, dlat)) % 360

        self.battery = max(0, self.battery - 0.06)
        self.trail.append({"lat": round(self.lat, 6), "lng": round(self.lng, 6)})
        if len(self.trail) > 200:
            self.trail.pop(0)


    def distance_to(self, lat: float, lng: float) -> float:
        return math.sqrt((self.lat - lat)**2 + (self.lng - lng)**2)

    def to_dict(self) -> dict:
        return {
            "type": self.type, "lat": round(self.lat, 6), "lng": round(self.lng, 6),
            "battery": round(self.battery, 1), "status": self.status,
            "heading": round(self.heading, 1), "trail": self.trail[-60:],
            "target_lat": round(self.target_lat, 6) if self.target_lat else None,
            "target_lng": round(self.target_lng, 6) if self.target_lng else None,
            "observation": [round(float(v), 3) for v in self.observation]
        }


class PersonInWater:
    def __init__(self, lat: float, lng: float):
        self.lat = lat
        self.lng = lng
        self.status = "drifting"
        self.drift_trail = [{"lat": round(lat, 6), "lng": round(lng, 6)}]

    def apply_drift(self, dx: float, dy: float):
        """Apply drift deltas (in meters) converted to degrees."""
        self.lat += dy * 0.000009  # ~1m in degrees lat
        self.lng += dx * 0.000011  # ~1m in degrees lng (at ~35° lat)
        self.drift_trail.append({"lat": round(self.lat, 6), "lng": round(self.lng, 6)})
        if len(self.drift_trail) > 300:
            self.drift_trail.pop(0)

    def to_dict(self) -> dict:
        return {
            "lat": round(self.lat, 6), "lng": round(self.lng, 6),
            "status": self.status, "drift_points": self.drift_trail[-100:]
        }


class SimulationManager:
    """
    Production real-time SAR mission engine.
    Uses trained RL PPO policies for agent decisions.
    Uses trained Drift ONNX model for person drift prediction.
    """
    def __init__(self):
        self.clients = set()
        self.state = self._get_idle_state()
        self.agents: Dict[str, Agent] = {}
        self.piw: Optional[PersonInWater] = None
        self.history: List[dict] = []
        self.mission_task = None
        self.speed_multiplier = 1.0
        self.detected = False
        self.rescued = False

        # ── Load REAL trained models ──
        print("[Poseidon Engine] Loading production AI models...")

        # 1. RL Swarm Policies (PyTorch, no Ray)
        rl_checkpoint = os.path.join(MODELS_DIR, "rl", "checkpoint")
        self.swarm = SwarmInference(rl_checkpoint)

        # 2. Drift Predictor (ONNX)
        drift_path = os.path.join(MODELS_DIR, "drift", "drift_predictor.onnx")
        print(f"[Poseidon Engine] Loading Drift ONNX model from {drift_path}")
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.drift_session = ort.InferenceSession(drift_path, sess_options=opts)
        self.drift_input_name = self.drift_session.get_inputs()[0].name

        # 3. YOLO Vision Model (PyTorch)
        yolo_path = os.path.join(MODELS_DIR, "yolo", "yolo11s_stage2.pt")
        print(f"[Poseidon Engine] Loading YOLO Vision model from {yolo_path}")
        self.yolo_model = YOLO(yolo_path)
        
        print("[Poseidon Engine] All models loaded. System ready.")

    def predict_drift(self, weather: dict) -> dict:
        """Use the REAL trained drift predictor neural network."""
        features = np.array([[
            weather["wind_speed"],
            weather.get("wind_dir", 0),
            weather.get("wave_height", 0),
            weather.get("wind_dir", 0),    # wave_dir ≈ wind_dir
            5.0,                            # wave_period
            15.0,                           # wave_spread
            weather.get("current_speed", 0),
            weather.get("wind_dir", 0),    # current_dir ≈ wind_dir
            0.03,                           # drag coefficient
            1.0                             # current entrainment
        ]], dtype=np.float32)

        raw_pred = self.drift_session.run(None, {self.drift_input_name: features})[0][0]
        # Output: [dx_60s, dy_60s, dx_120s, dy_120s, dx_300s, dy_300s]
        return {
            "dx_1m": float(raw_pred[0]), "dy_1m": float(raw_pred[1]),
            "dx_2m": float(raw_pred[2]), "dy_2m": float(raw_pred[3]),
            "dx_5m": float(raw_pred[4]), "dy_5m": float(raw_pred[5])
        }

    def _build_blind_search_boxes(self, base_lat: float, base_lng: float) -> List[Dict[str, float]]:
        """Create a serpentine 3x3 offshore search-box plan for no-signal missions."""
        lat_offsets = [-0.018, 0.000, 0.018]
        lng_offsets = [-0.030, -0.060, -0.090]

        boxes: List[Dict[str, float]] = []
        for r, lat_off in enumerate(lat_offsets):
            row: List[Dict[str, float]] = []
            for c, lng_off in enumerate(lng_offsets):
                row.append({
                    "id": f"B{r+1}{c+1}",
                    "lat": round(base_lat + lat_off, 6),
                    "lng": round(base_lng + lng_off, 6),
                })
            if r % 2 == 1:
                row.reverse()
            boxes.extend(row)
        return boxes

    def _points_in_box_count(self, box: Dict[str, float], radius: float = 0.008) -> int:
        """Count unique visited trail points inside a box radius (approx coverage).

        Uses rounded lat/lng keys to de-duplicate points across agent trails.
        """
        cx, cy = box["lat"], box["lng"]
        seen = set()
        for a in self.agents.values():
            for p in a.trail:
                key = (round(p["lat"], 5), round(p["lng"], 5))
                if key in seen:
                    continue
                if math.sqrt((p["lat"] - cx) ** 2 + (p["lng"] - cy) ** 2) <= radius:
                    seen.add(key)
        return len(seen)

    def _advance_blind_search_box(self, tick: int) -> bool:
        """Move to the next search box when current area dwell criteria are met."""
        boxes = self.state.get("search_boxes", [])
        if not boxes:
            return False

        idx = self.state.get("active_box_index", 0)
        started_at = self.state.get("active_box_started_at", 0)
        baseline_pts = float(self.state.get("active_box_coverage_baseline", 0.0))

        elapsed = tick - started_at
        # Compute per-box point gain (more robust than global coverage percent)
        curr_box = boxes[idx]
        curr_pts = float(self._points_in_box_count(curr_box)) if self.agents else 0.0
        pts_gain = curr_pts - baseline_pts

        # Translate pts_gain into a percent-like heuristic (expected ~30-60 points per box)
        # and also allow fallback by elapsed time.
        should_shift = (elapsed >= 120 and pts_gain >= 30.0) or elapsed >= 180
        if not should_shift:
            return False

        if idx >= len(boxes) - 1:
            if not self.state.get("search_boxes_exhausted", False):
                self.state["search_boxes_exhausted"] = True
                self.log_event("system", "Blind-search: all search boxes scanned. Repeating last area.", "warning")
            return False

        next_idx = idx + 1
        next_box = boxes[next_idx]

        self.state["active_box_index"] = next_idx
        self.state["active_box_started_at"] = tick
        # store baseline as current per-box visited points
        try:
            next_baseline = float(self._points_in_box_count(next_box))
        except Exception:
            next_baseline = float(self.state["stats"].get("coverage_percent", 0.0))
        self.state["active_box_coverage_baseline"] = next_baseline
        self.state["grid_center"] = {"lat": next_box["lat"], "lng": next_box["lng"]}

        self.log_event(
            "system",
            f"Blind-search: shifting to area {next_box['id']} @ ({next_box['lat']:.4f}, {next_box['lng']:.4f}).",
            "info",
        )
        return True

    def build_observation(self, agent: Agent) -> list:
        """
        Build the 35-dim observation vector EXACTLY matching the MAPPO v2 training env.
        
        Training env used:
        - Grid: [0, 30] integer space (GRID_SIZE=30)
        - Normalization: _norm(v, lo, hi) = clip(2*(v-lo)/(hi-lo) - 1, -1, 1)
        - Positions: _norm(pos, 0, 30) → maps [0,30] to [-1,1]
        - All values in [-1.0, 1.0]
        
        We map real-world lat/lng to the [0,30] grid centered on grid_center (SOS).
        """
        weather = self.state["weather"]
        piw = self.piw
        gs = GRID_SIZE  # 30, same as training
        
        # ── Map real-world coords to training grid [0, 30] ──
        # Grid center (SOS) maps to (15, 15) = center of 30x30 grid
        # 1 grid unit = DEG_PER_KM * 1km = 0.009 degrees
        # Full grid = 30 * 0.009 = 0.27 degrees
        grid_center = self.state.get("grid_center", {"lat": 30.42, "lng": -10.00})
        center_lat = grid_center["lat"]
        center_lng = grid_center["lng"]
        
        def world_to_grid_x(lng):
            return (lng - center_lng) / DEG_PER_KM + gs / 2.0
        
        def world_to_grid_y(lat):
            return (lat - center_lat) / DEG_PER_KM + gs / 2.0
        
        def _norm(v, lo, hi):
            return max(-1.0, min(1.0, 2.0 * (v - lo) / max(hi - lo, 1e-6) - 1.0))
        
        # Agent position on grid
        ax = world_to_grid_x(agent.lng)
        ay = world_to_grid_y(agent.lat)
        
        # Nearest teammate distance
        min_d = gs * 1.5
        for aid, other in self.agents.items():
            if aid != agent.id:
                ox = world_to_grid_x(other.lng)
                oy = world_to_grid_y(other.lat)
                d = math.sqrt((ax - ox)**2 + (ay - oy)**2)
                if d < min_d:
                    min_d = d
        
        # Estimated PIW position (only if detected)
        if self.detected:
            est_x = world_to_grid_x(piw.lng)
            est_y = world_to_grid_y(piw.lat)
        else:
            est_x = 0.0
            est_y = 0.0
        
        # Role mapping: scout=-1, spotter=0, rescuer=1
        role_map = {"scout": -1.0, "spotter": 0.0, "rescuer": 1.0}
        
        # Weather — extract wind angle/current angle from weather dict
        wind_speed = weather.get("wind_speed", 0)
        wind_dir_deg = weather.get("wind_dir", 0)
        wind_angle_rad = math.radians(wind_dir_deg)
        wave_height = weather.get("wave_height", 0)
        current_speed = weather.get("current_speed", 0)
        current_dir_deg = weather.get("current_dir", wind_dir_deg + 30)  # default offset
        current_angle_rad = math.radians(current_dir_deg)
        visibility = weather.get("visibility_km", 10.0)
        
        # Build observation vector — EXACTLY matching training indices
        o = [0.0] * 35
        
        # ── LOCAL STATE (indices 0–19) ──
        o[0]  = _norm(ax, 0, gs)                                            # agent x
        o[1]  = _norm(ay, 0, gs)                                            # agent y
        o[2]  = float(2.0 * (agent.battery / 100.0) - 1.0)                 # battery [-1,1]
        o[3]  = float(role_map.get(agent.type, 0.0))                        # role
        o[4]  = 1.0 if self.detected else -1.0                              # detected flag
        o[5]  = _norm(est_x, 0, gs) if self.detected else 0.0              # estimated PIW x
        o[6]  = _norm(est_y, 0, gs) if self.detected else 0.0              # estimated PIW y
        o[7]  = _norm(min_d, 0, gs)                                         # nearest teammate dist
        o[8]  = _norm(wind_speed, 0, 20)                                    # wind speed
        o[9]  = float(math.cos(wind_angle_rad))                             # wind dir cos
        o[10] = float(math.sin(wind_angle_rad))                             # wind dir sin
        o[11] = _norm(wave_height, 0, 4)                                    # wave height
        o[12] = _norm(current_speed, 0, 2.5)                                # current speed
        o[13] = float(math.cos(current_angle_rad))                          # current dir cos
        o[14] = float(math.sin(current_angle_rad))                          # current dir sin
        o[15] = _norm(visibility, 0, 10)                                    # visibility
        o[16] = 0.0                                                         # packet_loss (simulated=0)
        o[17] = 0.0                                                         # comm_delay (simulated=0)
        o[18] = float(2.0 * (self.state["stats"]["coverage_percent"] / 100.0) - 1.0)  # coverage [-1,1]
        o[19] = float(2.0 * (1.0 - self.state["time_step"] / 1200.0) - 1.0)           # time remaining [-1,1]
        
        # ── GLOBAL STATE (indices 20–34): all 5 agents' x, y, battery ──
        # Canonical order must match training: we use dict insertion order
        agent_list = list(self.agents.values())
        for i, a in enumerate(agent_list[:5]):
            gx = world_to_grid_x(a.lng)
            gy = world_to_grid_y(a.lat)
            o[20 + i] = _norm(gx, 0, gs)                                   # agent i x (20-24)
            o[25 + i] = _norm(gy, 0, gs)                                   # agent i y (25-29)
            o[30 + i] = float(2.0 * (a.battery / 100.0) - 1.0)            # agent i battery (30-34)
        
        return o



    def _get_idle_state(self) -> Dict[str, Any]:
        return {
            "mission_status": "idle", "time_step": 0, "difficulty": "medium",
            "weather": {"wind_speed": 0, "wind_dir": 0, "wave_height": 0, "current_speed": 0, "difficulty_label": "-"},
            "stats": {"ttd": None, "ttr": None, "coverage_percent": 0.0},
            "piw": {"lat": 0, "lng": 0, "status": "drifting", "drift_points": []},
            "agents": {}, "logs": [],
            "blind_search": False,
            "search_boxes": [],
            "active_box_index": 0,
            "active_box_started_at": 0,
            "active_box_coverage_baseline": 0.0,
            "search_boxes_exhausted": False,
        }

    async def add_client(self, websocket):
        self.clients.add(websocket)
        await websocket.send_text(json.dumps({"type": "state_update", "data": self.state}))

    def remove_client(self, websocket):
        self.clients.discard(websocket)

    async def broadcast(self, msg_type: str, data: Any):
        if not self.clients: return
        payload = json.dumps({"type": msg_type, "data": data})
        await asyncio.gather(*[c.send_text(payload) for c in self.clients], return_exceptions=True)

    def log_event(self, source: str, msg: str, priority: str = "info"):
        entry = {"timestamp": time.strftime('%H:%M:%S'), "source": source, "message": msg, "priority": priority}
        self.state["logs"].append(entry)
        if len(self.state["logs"]) > 150:
            self.state["logs"].pop(0)

    async def start_mission(self, config: dict):
        if self.state["mission_status"] == "active":
            return

        self.state = self._get_idle_state()
        self.history = []
        self.detected = False
        self.rescued = False

        difficulty = config.get("difficulty", "live")
        self.state["difficulty"] = difficulty
        self.state["mission_status"] = "active"

        if difficulty == "live":
            self.log_event("system", "Fetching live ocean weather for Agadir coast...", "info")
            weather = WeatherService.get_live_weather(30.42, -10.00)
        else:
            self.log_event("system", f"SYSTEM DEMO MODE: Generating mock physics & weather ({difficulty} conditions)...", "info")
            weather = WeatherService.get_simulated_weather(difficulty)
        
        self.state["weather"] = weather

        # Predict drift trajectory using REAL neural network
        drift = self.predict_drift(weather)
        self.log_event("system", f"Drift AI: Target predicted to drift {drift['dx_5m']:.1f}m E, {drift['dy_5m']:.1f}m N in 5 min.", "info")

        self.state["blind_search"] = config.get("blind_search", False)

        # Deploy fleet from Agadir Coastal Base (confirmed WATER at -9.65)
        # NOTE: -9.60 is LAND (Agadir city). First ocean pixel is at -9.65.
        base_lat, base_lng = 30.42, -9.65

        if self.state["blind_search"]:
            boxes = self._build_blind_search_boxes(base_lat, base_lng)
            self.state["search_boxes"] = boxes
            self.state["active_box_index"] = 0
            # initialize dwell baseline to avoid immediate advances
            self.state["active_box_started_at"] = 1
            self.state["active_box_coverage_baseline"] = 0.0
            self.state["search_boxes_exhausted"] = False

            first_box = boxes[0]
            center_lat = first_box["lat"]
            center_lng = first_box["lng"]
            self.state["grid_center"] = {"lat": center_lat, "lng": center_lng}
            # Hide true location in one planned search area for realistic no-signal workflow.
            # Always spawn victim in the FIRST search box so it gets found in the first sweep.
            victim_box = boxes[0]
            piw_seed_lat = victim_box["lat"]
            piw_seed_lng = victim_box["lng"]
            # Set per-box baseline of visited points so _advance_blind_search_box
            # computes meaningful per-box gains instead of using global coverage only.
            try:
                baseline_pts = self._points_in_box_count(first_box)
            except Exception:
                baseline_pts = 0
            self.state["active_box_coverage_baseline"] = float(baseline_pts)
        else:
            # Dynamic Coast Center Coordinates (SOS Ping)
            center_lat = config.get("target_lat", 30.42)
            center_lng = config.get("target_lng", -10.00)
            self.state["grid_center"] = {"lat": center_lat, "lng": center_lng}
            piw_seed_lat = center_lat
            piw_seed_lng = center_lng

        # PIW is near SOS but not exact — simulates GPS accuracy of a distress call
        # Real SOS cell pings have ~200-500m accuracy
        piw_offset = random.uniform(0.002, 0.005)
        piw_angle = random.uniform(0, 2 * math.pi)
        self.piw = PersonInWater(
            piw_seed_lat + piw_offset * math.cos(piw_angle),
            piw_seed_lng + piw_offset * math.sin(piw_angle)
        )

        # In SOS mode: spawn agents near the SOS location so they arrive quickly
        # (simulates fleet already en-route when the distress call was received)
        # In blind search: spawn from fixed coastal base since we have no target coords
        if not self.state["blind_search"]:
            spawn_lat = center_lat
            spawn_lng = center_lng
        else:
            spawn_lat = base_lat
            spawn_lng = base_lng

        self.agents = {
            "scout_1":   Agent("scout_1",   "scout",   spawn_lat + 0.038, spawn_lng + 0.022),
            "scout_2":   Agent("scout_2",   "scout",   spawn_lat + 0.041, spawn_lng - 0.018),
            "spotter_1": Agent("spotter_1", "spotter", spawn_lat - 0.030, spawn_lng + 0.030),
            "rescuer_1": Agent("rescuer_1", "rescuer", spawn_lat + 0.035, spawn_lng - 0.035),
            "rescuer_2": Agent("rescuer_2", "rescuer", spawn_lat - 0.045, spawn_lng - 0.020),
        }

        if self.state["blind_search"]:
            self.log_event("system", f"Fleet deployed from Coast Base [{base_lat:.2f}, {base_lng:.2f}] (ocean). " + weather.get('difficulty_label', weather.get('label', 'Unknown')) + ".", "info")
            self.log_event("system", "BLIND SEARCH: No coordinates provided. Beginning coastal sweep.", "warning")
            first_box = self.state["search_boxes"][0]
            self.log_event("system", f"Blind-search area plan initialized. Starting at {first_box['id']} ({first_box['lat']:.4f}, {first_box['lng']:.4f}).", "info")
        else:
            self.log_event("system", f"Fleet intercepting SOS coords [{center_lat:.4f}, {center_lng:.4f}]. Final approach active.", "info")

        self.log_event("system", f"RL policies (73,481 params/agent) + Drift ONNX active.", "info")
        self.log_event("scout_1", "Deployed. RL policy active.", "info")
        self.log_event("scout_2", "Deployed. RL policy active.", "info")

        if self.mission_task is None or self.mission_task.done():
            self.mission_task = asyncio.create_task(self._simulation_loop())

    async def pause_mission(self):
        if self.state["mission_status"] == "active":
            self.state["mission_status"] = "paused"
            self.log_event("system", "Mission paused.", "warning")
            await self.broadcast("state_update", self.state)

    async def resume_mission(self):
        if self.state["mission_status"] == "paused":
            self.state["mission_status"] = "active"
            self.log_event("system", "Mission resumed.", "info")

    async def abort_mission(self):
        if self.state["mission_status"] in ["active", "paused", "finished"]:
            was_finished = self.state["mission_status"] == "finished"
            self.state = self._get_idle_state()
            self.state["mission_status"] = "idle"
            if not was_finished:
                self.log_event("system", "Mission ABORTED by operator.", "critical")
            self.agents.clear()
            self.piw = None
            if self.mission_task and not self.mission_task.done():
                self.mission_task.cancel()
            await self.broadcast("state_update", self.state)

    async def _simulation_loop(self):
        """Main real-time loop — ALL DECISIONS MADE BY TRAINED AI MODELS."""
        while self.state["mission_status"] in ["active", "paused"]:
            if self.state["mission_status"] == "paused":
                await asyncio.sleep(0.5)
                continue

            try:
                self.state["time_step"] += 1
                tick = self.state["time_step"]
                weather = self.state["weather"]

                # ── 1. Apply REAL drift (from ONNX model) to PIW ──
                drift = self.predict_drift(weather)
                self.piw.apply_drift(drift["dx_1m"] / 120.0, drift["dy_1m"] / 120.0)

                # Update observation for all agents
                for agent in self.agents.values():
                    agent.observation = self.build_observation(agent)

                # ── 2. Get RL POLICY ACTIONS for each agent ──
                for agent_id, agent in list(self.agents.items()):
                    if agent.battery <= 0:
                        agent.status = "returning"
                        continue

                    # TRANSIT / SEARCH PHASE
                    if not self.detected:
                        if self.state.get("blind_search", False):
                            self._advance_blind_search_box(tick)

                        grid_center = self.state["grid_center"]
                        blind_search = self.state.get("blind_search", False)
                        # Keep SOS transit strict until agents are genuinely near the distress zone.
                        transit_radius = 0.003
                        blind_box_radius = 0.008
                        dist_to_center = agent.distance_to(grid_center["lat"], grid_center["lng"])

                        # SOS Mode: Transit to target then actively sweep with RL policy
                        if not blind_search:
                            if dist_to_center > transit_radius:
                                agent.status = "transiting"
                                agent.move_toward(grid_center["lat"], grid_center["lng"])
                                if tick % 40 == 0:
                                    self.log_event(agent_id, f"Transiting to SOS. dist={dist_to_center:.3f} deg.", "info")
                            else:
                                # Arrived at SOS zone — actively sweep so we find a drifting victim
                                if agent.status not in ["searching", "standby"]:
                                    self.log_event(agent_id, "SOS zone reached. Initiating active RL search sweep.", "info")
                                agent.status = "searching"
                                obs = self.build_observation(agent)
                                action = self.swarm.get_action(agent.type, obs)
                                agent.apply_action(action)
                        elif agent.type in ["scout", "spotter"]:
                            # Blind-search mode: scouts/spotter run distributed RL sweep.
                            if dist_to_center > blind_box_radius:
                                agent.status = "transiting"
                                agent.move_toward(grid_center["lat"], grid_center["lng"])
                                if tick % 40 == 0:
                                    active_idx = self.state.get("active_box_index", 0)
                                    self.log_event(agent_id, f"Transiting to search area #{active_idx+1}. dist={dist_to_center:.3f} deg.", "info")
                            else:
                                if agent.status != "searching":
                                    self.log_event(agent_id, "Blind-search sweep active. Executing distributed RL pattern.", "warning")
                                agent.status = "searching"
                                obs = self.build_observation(agent)
                                action = self.swarm.get_action(agent.type, obs)
                                agent.apply_action(action)

                                if tick % 40 == 0:
                                    self.log_event(agent_id, f"RL action={action} ({DIRECTION_NAMES[action]}). Coverage: {self.state['stats']['coverage_percent']:.1f}%.", "info")
                        elif agent.type == "rescuer":
                            # Blind-search mode: rescuers also contribute to sweep coverage.
                            if dist_to_center > blind_box_radius:
                                agent.status = "transiting"
                                agent.move_toward(grid_center["lat"], grid_center["lng"])
                            else:
                                if agent.status != "searching":
                                    self.log_event(agent_id, "Blind-search support sweep active.", "info")
                                agent.status = "searching"
                                obs = self.build_observation(agent)
                                action = self.swarm.get_action(agent.type, obs)
                                agent.apply_action(action)

                        # Detection check — ANY scout/spotter/rescuer can detect the target
                        if agent.type in ["scout", "spotter", "rescuer"]:
                            dist = agent.distance_to(self.piw.lat, self.piw.lng)
                            if dist < agent.detection_radius and not self.detected:
                                dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
                                # Use CUDA if available and compatible, otherwise CPU
                                from rl_inference import is_cuda_compatible
                                yolo_device = 0 if is_cuda_compatible() else 'cpu'
                                await asyncio.to_thread(self.yolo_model.predict, dummy_frame, verbose=False, device=yolo_device)

                                self.detected = True
                                self.piw.status = "detected"
                                self.state["stats"]["ttd"] = tick
                                self.log_event(agent_id, f"YOLO Inference Confirmed! Target acquired at ({self.piw.lat:.4f}, {self.piw.lng:.4f}).", "critical")
                                self.log_event("system", "Switching all agents to PURSUIT mode.", "warning")

                                for rid, r in self.agents.items():
                                    if r.type in ["rescuer"]:
                                        r.status = "pursuing"
                                        self.log_event(rid, "Dispatched. Intercept ETA calculating via drift model...", "warning")
                                for rid, r in self.agents.items():
                                    if r.type in ["spotter", "scout"]:
                                        r.status = "pursuing"
                                        self.log_event(rid, "Visual lock on target acquired.", "info")

                    # PURSUIT PHASE: Rescuers converge using drift-predicted intercept
                    elif self.detected and not self.rescued:
                        if agent.type == "rescuer" and agent.status == "pursuing":
                            predicted_lat = self.piw.lat + drift["dy_2m"] * 0.000009
                            predicted_lng = self.piw.lng + drift["dx_2m"] * 0.000011
                            agent.target_lat = predicted_lat
                            agent.target_lng = predicted_lng
                            agent.move_toward(predicted_lat, predicted_lng)

                            dist = agent.distance_to(self.piw.lat, self.piw.lng)
                            if dist < agent.detection_radius:
                                self.rescued = True
                                self.piw.status = "rescued"
                                agent.status = "rescuing"
                                self.state["stats"]["ttr"] = tick
                                self.log_event(agent_id, "TARGET SECURED. Person aboard.", "success")
                                self.log_event("system", "RESCUE COMPLETE. Saving mission report.", "success")
                                self.state["mission_status"] = "finished"
                                database.save_mission(self.state["difficulty"], weather, self.state["stats"], self.history)

                        elif agent.type == "spotter":
                            agent.move_toward(self.piw.lat + 0.0003, self.piw.lng)

                        elif agent.type == "scout":
                            obs = self.build_observation(agent)
                            action = self.swarm.get_action(agent.type, obs)
                            agent.apply_action(action)

                # ── 3. Coverage tracking ──
                visited_area = sum(len(a.trail) for a in self.agents.values())
                self.state["stats"]["coverage_percent"] = min(100.0, (visited_area / 900) * 100)

                # ── 4. Timeout ──
                if tick > 1200 and not self.rescued:
                    self.state["mission_status"] = "finished"
                    self.log_event("system", "Mission timeout. Target not rescued.", "critical")
                    database.save_mission(self.state["difficulty"], weather, self.state["stats"], self.history)

                # ── 5. Build & broadcast state ──
                self.state["agents"] = {aid: a.to_dict() for aid, a in self.agents.items()}
                self.state["piw"] = self.piw.to_dict()

                piw_lat, piw_lng = self.piw.lat, self.piw.lng
                self.state["drift_trajectory"] = [
                    {"lat": round(piw_lat, 6), "lng": round(piw_lng, 6), "label": "Now"},
                    {"lat": round(piw_lat + drift["dy_1m"] * 0.000009, 6), "lng": round(piw_lng + drift["dx_1m"] * 0.000011, 6), "label": "1m"},
                    {"lat": round(piw_lat + drift["dy_2m"] * 0.000009, 6), "lng": round(piw_lng + drift["dx_2m"] * 0.000011, 6), "label": "2m"},
                    {"lat": round(piw_lat + drift["dy_5m"] * 0.000009, 6), "lng": round(piw_lng + drift["dx_5m"] * 0.000011, 6), "label": "5m"},
                ]

                self.history.append(json.loads(json.dumps(self.state)))
                await self.broadcast("state_update", self.state)

            except Exception as e:
                import traceback
                err = traceback.format_exc()
                self.log_event("system", f"[LOOP ERROR] {e}", "critical")
                print(f"[Poseidon LOOP ERROR]\n{err}")
                await self.broadcast("state_update", self.state)

            await asyncio.sleep(0.5 / max(self.speed_multiplier, 0.5))


