import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "missions.db")

def init_db():
    """Initializes the SQLite database if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            weather JSON NOT NULL,
            final_stats JSON NOT NULL,
            history_json JSON NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_mission(difficulty: str, weather: dict, final_stats: dict, history: list) -> int:
    """Saves a completed mission and returns the mission ID."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO missions (timestamp, difficulty, weather, final_stats, history_json)
        VALUES (?, ?, ?, ?, ?)
    """, (
        timestamp,
        difficulty,
        json.dumps(weather),
        json.dumps(final_stats),
        json.dumps(history)
    ))
    
    mission_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return mission_id

def get_recent_missions(limit: int = 10) -> list:
    """Returns a list of recent mission summaries (excluding the heavy history JSON)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, timestamp, difficulty, weather, final_stats 
        FROM missions 
        ORDER BY id DESC LIMIT ?
    """, (limit,))
    
    missions = []
    for row in cursor.fetchall():
        missions.append({
            "id": row[0],
            "timestamp": row[1],
            "difficulty": row[2],
            "weather": json.loads(row[3]),
            "final_stats": json.loads(row[4])
        })
    conn.close()
    return missions

def get_mission_by_id(mission_id: int) -> dict:
    """Returns the full mission data including the frame-by-frame history."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, timestamp, difficulty, weather, final_stats, history_json 
        FROM missions WHERE id = ?
    """, (mission_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return {
        "id": row[0],
        "timestamp": row[1],
        "difficulty": row[2],
        "weather": json.loads(row[3]),
        "final_stats": json.loads(row[4]),
        "history_json": json.loads(row[5])
    }

# Initialize on import
init_db()
