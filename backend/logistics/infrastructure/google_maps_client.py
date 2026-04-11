import time
import logging
import requests
from django.conf import settings
from typing import Optional

logger = logging.getLogger(__name__)

class GoogleMapsClient:
    """
    Infrastructure layer client for Google Maps Platform.
    Handles all external network calls with explicit timeouts and error boundary logging.
    """
    
    TIMEZONE_API_URL = "https://maps.googleapis.com/maps/api/timezone/json"

    @classmethod
    def get_timezone(cls, latitude: float, longitude: float) -> Optional[str]:
        """
        Fetches the IANA timezone string for given coordinates.
        Returns None if the API fails or the key is missing.
        """
        api_key = getattr(settings, "GOOGLE_MAPS_BACKEND_KEY", None)
        
        if not api_key:
            logger.warning("GOOGLE_MAPS_BACKEND_KEY is not configured. Timezone auto-resolve skipped.")
            return None

        # The Time Zone API requires a timestamp to determine daylight saving time (DST) offsets.
        # We pass the current time, though the base timezone string (e.g., 'Europe/Warsaw') is what we need.
        params = {
            "location": f"{latitude},{longitude}",
            "timestamp": int(time.time()),
            "key": api_key
        }

        try:
            # 5-second timeout is critical. Never block the backend indefinitely on external API calls.
            response = requests.get(cls.TIMEZONE_API_URL, params=params, timeout=5.0)
            response.raise_for_status()
            data = response.json()

            if data.get("status") == "OK":
                return data.get("timeZoneId")  # e.g., "Europe/Warsaw", "Asia/Tokyo"
            
            logger.error(f"Google Maps Timezone API returned logical error: {data.get('status')} - {data.get('errorMessage')}")
            return None
            
        except requests.RequestException as e:
            logger.error(f"Network error while connecting to Google Maps Timezone API: {e}")
            return None