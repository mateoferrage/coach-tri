"""
Vercel Python Serverless Function — Garmin sync endpoint.
Called internally by the Next.js Route Handler at /api/garmin/sync.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import date, timedelta, datetime

try:
    from garminconnect import Garmin
    GARMIN_AVAILABLE = True
except ImportError:
    GARMIN_AVAILABLE = False


def sync_garmin(email: str, password: str, since: str, session_data: dict | None):
    """
    Authenticate to Garmin Connect and fetch activities + wellness data since `since` (YYYY-MM-DD).
    Returns dict with activities, wellness, and updated session_data.
    """
    client = Garmin(email, password)

    # Reuse existing session to avoid re-login (important for rate limits)
    if session_data:
        try:
            client.garth.loads(session_data)
            client.display_name  # triggers lazy auth check
        except Exception:
            client.login()
    else:
        client.login()

    since_date = datetime.strptime(since, "%Y-%m-%d").date()
    today = date.today()

    # --- Activities ---
    activities_raw = client.get_activities_by_date(
        since_date.isoformat(), today.isoformat()
    )

    activities = []
    for a in activities_raw:
        activities.append({
            "garmin_activity_id": a.get("activityId"),
            "activity_type": map_activity_type(a.get("activityType", {}).get("typeKey", "")),
            "started_at": a.get("startTimeLocal"),
            "duration_s": int(a.get("duration", 0)),
            "distance_m": a.get("distance"),
            "avg_hr": a.get("averageHR"),
            "max_hr": a.get("maxHR"),
            "avg_speed_ms": a.get("averageSpeed"),
            "elevation_gain_m": a.get("elevationGain"),
            "training_effect": a.get("aerobicTrainingEffect"),
            "aerobic_te": a.get("aerobicTrainingEffect"),
            "anaerobic_te": a.get("anaerobicTrainingEffect"),
            "raw_data": a,
        })

    # --- Wellness (daily stats) ---
    wellness = []
    current = since_date
    while current <= today:
        day_str = current.isoformat()
        try:
            stats = client.get_stats(day_str)
            sleep = client.get_sleep_data(day_str)
            hrv = client.get_hrv_data(day_str)

            sleep_summary = sleep.get("dailySleepDTO", {})
            hrv_summary = hrv.get("hrvSummary", {}) if hrv else {}

            wellness.append({
                "date": day_str,
                "sleep_duration_s": sleep_summary.get("sleepTimeSeconds"),
                "sleep_score": sleep_summary.get("sleepScores", {}).get("overall", {}).get("value"),
                "hrv_rmssd": hrv_summary.get("lastNight"),
                "body_battery_start": stats.get("bodyBatteryMostRecentValue"),
                "body_battery_end": None,
                "stress_avg": stats.get("averageStressLevel"),
                "resting_hr": stats.get("restingHeartRate"),
                "steps": stats.get("totalSteps"),
                "total_calories": stats.get("totalKilocalories"),
            })
        except Exception:
            pass  # Skip days with no data
        current += timedelta(days=1)

    return {
        "activities": activities,
        "wellness": wellness,
        "session_data": client.garth.dumps(),
    }


def map_activity_type(type_key: str) -> str:
    mapping = {
        "swimming": "swim",
        "open_water_swimming": "swim",
        "cycling": "bike",
        "road_biking": "bike",
        "mountain_biking": "bike",
        "running": "run",
        "trail_running": "run",
        "treadmill_running": "run",
        "triathlon": "triathlon",
    }
    return mapping.get(type_key, "other")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not GARMIN_AVAILABLE:
            self._json_response(503, {"error": "garminconnect not installed"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))

            # Basic auth check — expect internal secret header
            secret = self.headers.get("X-Internal-Secret", "")
            if secret != os.environ.get("INTERNAL_SECRET", ""):
                self._json_response(401, {"error": "Unauthorized"})
                return

            result = sync_garmin(
                email=body["email"],
                password=body["password"],
                since=body["since"],
                session_data=body.get("session_data"),
            )

            self._json_response(200, {
                "activities": result["activities"],
                "wellness": result["wellness"],
                "session_data": result["session_data"],
                "activities_count": len(result["activities"]),
                "wellness_count": len(result["wellness"]),
            })

        except KeyError as e:
            self._json_response(400, {"error": f"Missing field: {e}"})
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _json_response(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # Silence default logging
