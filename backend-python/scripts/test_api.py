"""Quick smoke test for all major API endpoints."""
import json
import urllib.request
import urllib.parse

BASE = "http://127.0.0.1:8000"

def get(path):
    r = urllib.request.urlopen(f"{BASE}{path}")
    return json.loads(r.read().decode())

def post_form(path, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    r = urllib.request.urlopen(req)
    return json.loads(r.read().decode())

def get_auth(path, token):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {token}"})
    r = urllib.request.urlopen(req)
    return json.loads(r.read().decode())

print("=== 1. GET /api/get-all-restaurant/ ===")
restaurants = get("/api/get-all-restaurant/")
print(f"  Count: {len(restaurants)}")
for r in restaurants:
    print(f"  #{r['restaurantId']}: {r['name']} (seats: {r['availableSeats']}/{r['totalSeats']})")

print("\n=== 2. GET /api/get-restaurant/1 (with menu) ===")
r1 = get("/api/get-restaurant/1")
print(f"  Name: {r1['name']}")
print(f"  Menu items: {len(r1.get('menu', []))}")
for m in r1.get("menu", []):
    print(f"    - {m['name']}: {m['price']}d")

print("\n=== 3. GET /api/get-all-user/ ===")
users = get("/api/get-all-user/")
print(f"  Count: {len(users)}")
for u in users:
    print(f"  #{u['userId']}: {u['name']} ({u['email']}) role={u['role']}")

print("\n=== 4. POST /api/authentication/login (customer) ===")
token_data = post_form("/api/authentication/login", {"username": "customer@tablenow.vn", "password": "customer123"})
token = token_data["access_token"]
print(f"  Token: {token[:40]}...")

print("\n=== 5. GET /api/authentication/active-user ===")
me = get_auth("/api/authentication/active-user", token)
print(f"  User: {me['name']} ({me['email']}) role={me['role']}")

print("\n=== 6. POST /api/authentication/login (manager) ===")
mgr_data = post_form("/api/authentication/login", {"username": "manager@tablenow.vn", "password": "manager123"})
mgr_token = mgr_data["access_token"]
mgr = get_auth("/api/authentication/active-user", mgr_token)
print(f"  Manager: {mgr['name']} role={mgr['role']}")

print("\n=== 7. POST /api/authentication/login (admin) ===")
adm_data = post_form("/api/authentication/login", {"username": "admin@tablenow.vn", "password": "admin123"})
adm_token = adm_data["access_token"]
adm = get_auth("/api/authentication/active-user", adm_token)
print(f"  Admin: {adm['name']} role={adm['role']}")

print("\n=== 8. GET /api/get-all-booking/ ===")
bookings = get("/api/get-all-booking/")
print(f"  Count: {len(bookings)}")
for b in bookings:
    print(f"  #{b['bookingId']}: user {b['userId']} -> restaurant {b['restaurantId']} status={b['status']} seats={b['requestSeats']}/{b['assignedSeats']}")

print("\n=== 9. GET /api/get-bookings-by-user/4 ===")
user_bookings = get("/api/get-bookings-by-user/4")
print(f"  Bookings for user 4: {len(user_bookings)}")

print("\n=== 10. GET /api/get-bookings-by-restaurant/1 ===")
rest_bookings = get("/api/get-bookings-by-restaurant/1")
print(f"  Bookings for restaurant 1: {len(rest_bookings)}")

print("\n=== 11. GET /api/stats/manager/1 ===")
mgr_stats = get("/api/stats/manager/1")
print(f"  Stats: {json.dumps(mgr_stats, indent=2)}")

print("\n=== 12. GET /api/stats/admin ===")
adm_stats = get("/api/stats/admin")
print(f"  Stats: {json.dumps(adm_stats, indent=2)}")

print("\n=== 13. Filter: GET /api/get-all-restaurant/?featured=true ===")
featured = get("/api/get-all-restaurant/?featured=true")
print(f"  Featured count: {len(featured)}")

print("\n=== 14. GET /api/get-menuitems-by-restaurant/3 ===")
menu3 = get("/api/get-menuitems-by-restaurant/3")
print(f"  Menu items for restaurant 3: {len(menu3)}")
for m in menu3:
    print(f"    - {m['name']} ({m['category']}): {m['price']}d")

print("\n" + "=" * 50)
print("ALL SMOKE TESTS PASSED!")
print("=" * 50)
