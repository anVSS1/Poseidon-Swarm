import random
import urllib.request
import json
from typing import Dict, Any

class WeatherService:
    """
    Handles both simulated weather generation (for reproducible thesis demos)
    and live real-world polling from Open-Meteo Marine API.
    """
    
    @staticmethod
    def get_simulated_weather(difficulty: str) -> Dict[str, Any]:
        """Returns randomized weather within realistic boundaries based on scenario difficulty."""
        diff = difficulty.lower()
        
        if diff == "easy":
            return {
                "wind_speed": round(random.uniform(2.0, 5.0), 1), # m/s
                "wind_dir": round(random.uniform(0, 360), 0),
                "wave_height": round(random.uniform(0.1, 0.5), 2), # m
                "current_speed": round(random.uniform(0.1, 0.3), 2), # m/s
                "difficulty_label": "Calm Seas"
            }
        elif diff == "medium":
            return {
                "wind_speed": round(random.uniform(8.0, 15.0), 1),
                "wind_dir": round(random.uniform(0, 360), 0),
                "wave_height": round(random.uniform(1.2, 2.5), 2),
                "current_speed": round(random.uniform(0.5, 1.2), 2),
                "difficulty_label": "Choppy Waters"
            }
        else: # hard
            return {
                "wind_speed": round(random.uniform(20.0, 30.0), 1), # Gale force
                "wind_dir": round(random.uniform(0, 360), 0),
                "wave_height": round(random.uniform(3.5, 6.0), 2), # High waves
                "current_speed": round(random.uniform(1.5, 2.5), 2),
                "difficulty_label": "Storm Conditions"
            }

    @staticmethod
    def get_live_weather(lat: float, lng: float) -> Dict[str, Any]:
        """Pulls real-time maritime weather for a given GPS coordinate via Open-Meteo API."""
        try:
            # Querying the free Marine API for current wave height and wind speed
            url = f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lng}&current=wave_height,wave_direction,ocean_current_velocity&timezone=auto"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'PoseidonSwarm/1.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    current = data.get("current", {})
                    
                    # We also need surface wind from the standard weather API
                    wind_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms"
                    wind_req = urllib.request.Request(wind_url, headers={'User-Agent': 'PoseidonSwarm/1.0'})
                    
                    with urllib.request.urlopen(wind_req, timeout=5) as w_response:
                        w_data = json.loads(w_response.read().decode('utf-8'))
                        w_current = w_data.get("current", {})
                        
                        return {
                            "wind_speed": round(w_current.get("wind_speed_10m", 15.0), 1),
                            "wind_dir": round(w_current.get("wind_direction_10m", 0), 0),
                            "wave_height": round(current.get("wave_height", 2.0), 2),
                            "current_speed": round(current.get("ocean_current_velocity", 0.5), 2),
                            "difficulty_label": "Live API Data"
                        }
        except Exception as e:
            print(f"[WeatherService] Live API failed: {e}. Falling back to default.")
            return WeatherService.get_simulated_weather("medium")
        
        return WeatherService.get_simulated_weather("medium")
