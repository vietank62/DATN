"""One synthetic survey request; never prints API keys or customer data."""
import json
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
load_dotenv(root / ".env")

from core.taste_recommendations import rank_batch


def main():
    try:
        matches = rank_batch(
            {"favorites": "Thích món Việt", "avoid": "", "occasion": "", "budget": "", "atmosphere": "", "location": ""},
            [{"id": 1, "name": "Nhà hàng kiểm thử", "category": ["mon-viet"], "menu": [{"name": "Phở bò"}]}],
        )
        print(json.dumps({"ok": True, "matches": len(matches)}))
        return 0
    except httpx.HTTPStatusError as error:
        try:
            payload = error.response.json().get("error", {})
        except (ValueError, AttributeError):
            payload = {}
        # Only diagnostic identifiers, no request headers or provider message.
        print(json.dumps({"ok": False, "http_status": error.response.status_code,
                          "error_code": payload.get("code"), "error_type": payload.get("type")}))
    except (RuntimeError, httpx.HTTPError, ValueError, TypeError) as error:
        print(json.dumps({"ok": False, "error_type": type(error).__name__}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
