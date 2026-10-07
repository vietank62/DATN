import os

import httpx
from fastapi import HTTPException


def geocode_address(address: str, district: str, city: str) -> list[dict]:
    key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "Chưa cấu hình SerpAPI. Bạn vẫn có thể nhập tọa độ thủ công.")
    parts = [address.strip()]
    for part in (district.strip(), city.strip(), "Việt Nam"):
        if part and part.casefold() not in ", ".join(parts).casefold():
            parts.append(part)
    try:
        response = httpx.get(
            "https://serpapi.com/search.json",
            params={"engine": "google_maps", "q": ", ".join(parts), "api_key": key, "hl": "vi", "type": "search"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403, 429):
            raise HTTPException(503, "SerpAPI chưa sẵn sàng. Hãy kiểm tra khóa API và hạn mức.") from None
        raise HTTPException(502, "Không kết nối được dịch vụ tìm vị trí. Vui lòng thử lại.") from None
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Không kết nối được dịch vụ tìm vị trí. Vui lòng thử lại.") from None
    if not isinstance(data, dict):
        raise HTTPException(502, "Dịch vụ tìm vị trí trả về dữ liệu không hợp lệ.")
    if data.get("error"):
        raise HTTPException(503, "SerpAPI không xử lý được tìm kiếm. Hãy kiểm tra khóa API và hạn mức.")
    candidates = data.get("local_results", [])
    if isinstance(data.get("place_results"), dict):
        candidates = [data["place_results"], *(candidates if isinstance(candidates, list) else [])]
    if not isinstance(candidates, list):
        raise HTTPException(502, "Dịch vụ tìm vị trí trả về dữ liệu không hợp lệ.")
    results = []
    seen = set()
    for item in candidates:
        if not isinstance(item, dict) or not isinstance(item.get("gps_coordinates"), dict):
            continue
        location = item["gps_coordinates"]
        lat, lng = location.get("latitude"), location.get("longitude")
        if type(lat) in (int, float) and type(lng) in (int, float) and -90 <= lat <= 90 and -180 <= lng <= 180 and (lat, lng) not in seen:
            seen.add((lat, lng))
            results.append({"id": item.get("place_id") or item.get("data_id") or str(len(results)), "address": " · ".join(str(value) for value in (item.get("title"), item.get("address")) if value), "latitude": lat, "longitude": lng, "approximate": True})
            if len(results) == 5:
                break
    return results
