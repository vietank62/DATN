"""Authenticated, cached address search with per-account request limits."""
import time
from functools import lru_cache
from threading import Lock
from fastapi import HTTPException
from core.address_geocoding import geocode_address

_lock = Lock()
_requests = {}

@lru_cache(maxsize=256)
def _cached(address, bucket):
    return geocode_address(address, "", "")

def find_customer_address(user_id, address):
    address = " ".join(address.split())
    if len(address) < 5:
        raise HTTPException(422, "Vui lòng nhập địa chỉ ít nhất 5 ký tự.")
    now = time.monotonic()
    with _lock:
        for key in list(_requests):
            if now - _requests[key][0] >= 60:
                del _requests[key]
        start, count = _requests.get(user_id, (now, 0))
        if count >= 6:
            raise HTTPException(429, "Bạn tìm địa chỉ quá nhanh. Vui lòng thử lại sau một phút.")
        _requests[user_id] = (start, count + 1)
    return _cached(address.casefold(), int(time.time() // 600))
