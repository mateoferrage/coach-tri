"""
Vercel Python Serverless Function — Garmin sync.
Called internally by Next.js /api/garmin/sync with X-Internal-Secret header.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import time
from datetime import date, timedelta, datetime
from typing import Optional

try:
    from garminconnect import Garmin
    GARMIN_AVAILABLE = True
except ImportError:
    GARMIN_AVAILABLE = False

# Keep sync window small to stay within Vercel's 30s timeout
MAX_DAYS_BACK = 14


def authenticate(client: "Garmin", session_data: Optional[dict]) -> None:
    """Try to reuse an existing garth session, fall back to full login."""
    if session_data:
        try:
            # garth.loads() expects a JSON string — serialize if we got a dict
            token_str = (
                json.dumps(session_data)
                if isinstance(session_data, dict)
                else session_data
            )
            client.garth.loads(token_str)
            # Probe to confirm session is still valid
            _ = client.get_full_name()
            return
        except Exception:
            pass  # Session expired — fall through to fresh login
    client.login()


def dumps_session(client: "Garmin") -> dict:
    """
    garth.dumps() returns a dict in recent garminconnect versions.
    Normalise to dict for JSONB storage.
    """
    raw = client.garth.dumps()
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def sync_garmin(
    email: str,
    password: str,
    since: str,
    session_data: Optional[dict],
) -> dict:
    client = Garmin(email, password)
    authenticate(client, session_data)

    # Cap the look-back window
    since_date = datetime.strptime(since, "%Y-%m-%d").date()
    earliest = date.today() - timedelta(days=MAX_DAYS_BACK)
    if since_date < earliest:
        since_date = earliest
    today = date.today()

    # ── Activities (one batch call) ───────────────────────────────────────────
    activities = []
    try:
        raw_activities = client.get_activities_by_date(
            since_date.isoformat(), today.isoformat()
        )
        for a in raw_activities:
            activity_id = a.get("activityId")
            if not activity_id:
                continue
            activities.append({
                "garmin_activity_id": activity_id,
                "activity_type": map_activity_type(
                    a.get("activityType", {}).get("typeKey", "")
                ),
                "started_at": a.get("startTimeLocal"),
                "duration_s": int(a["duration"]) if a.get("duration") else None,
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
    except Exception:
        pass  # Non-fatal — continue with wellness

    # ── Wellness (one call per day — rate-limited) ────────────────────────────
    wellness = []
    current = since_date
    while current <= today:
        day_str = current.isoformat()
        try:
            stats = client.get_stats(day_str) or {}
            sleep_raw = client.get_sleep_data(day_str) or {}
            hrv_raw = client.get_hrv_data(day_str) or {}

            sleep_dto = sleep_raw.get("dailySleepDTO", {})
            hrv_summary = hrv_raw.get("hrvSummary", {})

            # Sleep score lives inside a nested dict in newer Garmin firmware
            sleep_score_obj = sleep_dto.get("sleepScores") or {}
            sleep_score = (
                sleep_score_obj.get("overall", {}).get("value")
                if isinstance(sleep_score_obj, dict)
                else None
            )

            wellness.append({
                "date": day_str,
                "sleep_duration_s": sleep_dto.get("sleepTimeSeconds"),
                "sleep_score": sleep_score,
                "hrv_rmssd": hrv_summary.get("lastNight"),
                "body_battery_start": stats.get("bodyBatteryMostRecentValue"),
                "body_battery_end": None,
                "stress_avg": stats.get("averageStressLevel"),
                "resting_hr": stats.get("restingHeartRate"),
                "steps": stats.get("totalSteps"),
                "total_calories": stats.get("totalKilocalories"),
            })
            time.sleep(0.25)  # ~4 req/s — Garmin's soft rate limit
        except Exception:
            pass  # Skip days with no data
        current += timedelta(days=1)

    return {
        "activities": activities,
        "wellness": wellness,
        "session_data": dumps_session(client),
        "activities_count": len(activities),
        "wellness_count": len(wellness),
    }


def map_activity_type(type_key: str) -> str:
    mapping = {
        "swimming": "swim",
        "pool_swimming": "swim",
        "open_water_swimming": "swim",
        "cycling": "bike",
        "road_biking": "bike",
        "mountain_biking": "bike",
        "indoor_cycling": "bike",
        "running": "run",
        "trail_running": "run",
        "treadmill_running": "run",
        "track_running": "run",
        "triathlon": "triathlon",
        "strength_training": "strength",
        "fitness_equipment": "strength",
        "yoga": "other",
        "walking": "other",
    }
    return mapping.get(type_key, "other")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not GARMIN_AVAILABLE:
            self._respond(503, {"error": "garminconnect library not installed"})
            return

        # Auth check
        secret = self.headers.get("X-Internal-Secret", "")
        if secret != os.environ.get("INTERNAL_SECRET", ""):
            self._respond(401, {"error": "Unauthorized"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))

            result = sync_garmin(
                email=body["email"],
                password=body["password"],
                since=body["since"],
                session_data=body.get("session_data"),
            )
            self._respond(200, result)

        except KeyError as e:
            self._respond(400, {"error": f"Missing required field: {e}"})
        except Exception as e:
            self._respond(500, {"error": str(e)})

    def _respond(self, status: int, data: dict) -> None:
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # silence default stdout logging
