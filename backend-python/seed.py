"""
Seed script for TableNow database.
Creates test users, restaurants, menu items, and bookings.
Run: python seed.py
"""
import json
import urllib.request
import urllib.parse

BASE = "http://127.0.0.1:8000"


def post(path: str, data: dict):
    """POST JSON to API and return parsed response."""
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  ERROR {e.code} on POST {path}: {err_body}")
        return None


def get(path: str):
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())


def put(path: str, data: dict = None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  ERROR {e.code} on PUT {path}: {err_body}")
        return None


# ─── 1. Users ──────────────────────────────────────────────
print("=== Creating Users ===")

users_data = [
    {"name": "Admin User",     "email": "admin@tablenow.vn",    "phone": "0900000001", "password": "admin123"},
    {"name": "Nguyễn Văn An",  "email": "manager@tablenow.vn",  "phone": "0900000002", "password": "manager123"},
    {"name": "Trần Thị Bình",  "email": "manager2@tablenow.vn", "phone": "0900000003", "password": "manager123"},
    {"name": "Lê Minh Châu",   "email": "customer@tablenow.vn", "phone": "0900000004", "password": "customer123"},
    {"name": "Phạm Đức Dũng",  "email": "customer2@tablenow.vn","phone": "0900000005", "password": "customer123"},
]

created_users = []
for u in users_data:
    result = post("/api/create-user/", u)
    if result:
        print(f"  Created user: {result['name']} (id={result['userId']})")
        created_users.append(result)
    else:
        print(f"  Skipped user: {u['email']} (may already exist)")

# Assign roles via direct update
if len(created_users) >= 5:
    admin_id = created_users[0]["userId"]
    manager1_id = created_users[1]["userId"]
    manager2_id = created_users[2]["userId"]
    customer1_id = created_users[3]["userId"]
    customer2_id = created_users[4]["userId"]

    put(f"/api/update-user/{created_users[0]['email']}", {"name": "Admin User"})
    put(f"/api/update-user/{created_users[1]['email']}", {"name": "Nguyễn Văn An"})
else:
    # Fetch existing users
    all_users = get("/api/get-all-user/")
    print(f"  Found {len(all_users)} existing users")
    admin_id = all_users[0]["userId"] if len(all_users) > 0 else 1
    manager1_id = all_users[1]["userId"] if len(all_users) > 1 else 2
    manager2_id = all_users[2]["userId"] if len(all_users) > 2 else 3
    customer1_id = all_users[3]["userId"] if len(all_users) > 3 else 4
    customer2_id = all_users[4]["userId"] if len(all_users) > 4 else 5

# Update roles — user.py update endpoint doesn't have role, so use SQL-level workaround
# We'll need to set roles. The UserUpdate schema doesn't include role, so let's add it.
# For now, let's update via a quick SQL workaround using the existing update endpoint.
# Actually, let's check if the update schema allows role:
# UserUpdate: name, phone, email, password, avatar — no role!
# We need to fix this. For seed purposes, let's do it via psycopg2 directly.

print("\n=== Setting User Roles (direct DB) ===")
try:
    import psycopg2
    conn = psycopg2.connect("postgresql://postgres:dhbkhcm2022@localhost:5432/tablenow")
    cur = conn.cursor()
    
    # Set admin role
    cur.execute('UPDATE "user" SET role = %s WHERE email = %s', ("admin", "admin@tablenow.vn"))
    cur.execute('UPDATE "user" SET role = %s WHERE email = %s', ("manager", "manager@tablenow.vn"))
    cur.execute('UPDATE "user" SET role = %s WHERE email = %s', ("manager", "manager2@tablenow.vn"))
    cur.execute('UPDATE "user" SET role = %s WHERE email = %s', ("customer", "customer@tablenow.vn"))
    cur.execute('UPDATE "user" SET role = %s WHERE email = %s', ("customer", "customer2@tablenow.vn"))
    conn.commit()
    
    # Get actual IDs
    cur.execute('SELECT "userId", email, role FROM "user" ORDER BY "userId"')
    rows = cur.fetchall()
    user_map = {}
    for row in rows:
        user_map[row[1]] = row[0]
        print(f"  User {row[0]}: {row[1]} → role={row[2]}")
    
    admin_id = user_map.get("admin@tablenow.vn", 1)
    manager1_id = user_map.get("manager@tablenow.vn", 2)
    manager2_id = user_map.get("manager2@tablenow.vn", 3)
    customer1_id = user_map.get("customer@tablenow.vn", 4)
    customer2_id = user_map.get("customer2@tablenow.vn", 5)
    
    cur.close()
    conn.close()
    print("  Roles updated successfully!")
except ImportError:
    print("  WARNING: psycopg2 not available, roles not set. Install with: pip install psycopg2-binary")
except Exception as e:
    print(f"  ERROR setting roles: {e}")

# ─── 2. Restaurants ────────────────────────────────────────
print("\n=== Creating Restaurants ===")

restaurants_data = [
    {
        "name": "Phở Thìn Bờ Hồ",
        "address": "13 Lò Đúc, Hai Bà Trưng",
        "district": "Quận 1",
        "cuisine": "Việt Nam",
        "priceRange": "Dưới 200K",
        "rating": 4.7,
        "reviewCount": 328,
        "imageUrl": "https://images.unsplash.com/photo-1503764654157-72d979d9af2f?w=800",
        "description": "Phở Thìn nổi tiếng với nước dùng đậm đà, thịt bò tươi ngon. Quán được thành lập từ năm 1979 và đã trở thành biểu tượng ẩm thực Hà Nội.",
        "openTime": "06:00",
        "closeTime": "22:00",
        "phone": "0901234567",
        "featured": True,
        "totalSeats": 40,
        "availableSeats": 35,
        "managerID": manager1_id,
    },
    {
        "name": "Nhà hàng Cục Gạch Quán",
        "address": "10 Đặng Tất, Tân Định, Quận 1",
        "district": "Quận 1",
        "cuisine": "Việt Nam",
        "priceRange": "200K - 500K",
        "rating": 4.5,
        "reviewCount": 512,
        "imageUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
        "description": "Cục Gạch Quán mang đến không gian ấm cúng với kiến trúc nhà cổ Sài Gòn. Menu đa dạng các món Việt truyền thống.",
        "openTime": "10:00",
        "closeTime": "23:00",
        "phone": "0287654321",
        "featured": True,
        "totalSeats": 60,
        "availableSeats": 45,
        "managerID": manager1_id,
    },
    {
        "name": "Pizza 4P's",
        "address": "8 Thủ Khoa Huân, Bến Thành, Quận 1",
        "district": "Quận 1",
        "cuisine": "Ý",
        "priceRange": "200K - 500K",
        "rating": 4.6,
        "reviewCount": 876,
        "imageUrl": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800",
        "description": "Pizza 4P's nổi tiếng với pizza nướng lò củi và phô mai tự làm. Không gian hiện đại, phù hợp cho gia đình và bạn bè.",
        "openTime": "10:00",
        "closeTime": "22:00",
        "phone": "0281234568",
        "featured": True,
        "totalSeats": 80,
        "availableSeats": 60,
        "managerID": manager2_id,
    },
    {
        "name": "Quán Bụi Garden",
        "address": "55A Nguyễn Bỉnh Khiêm, Đa Kao, Quận 1",
        "district": "Quận 1",
        "cuisine": "Việt Nam",
        "priceRange": "200K - 500K",
        "rating": 4.3,
        "reviewCount": 245,
        "imageUrl": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
        "description": "Quán Bụi Garden với không gian sân vườn xanh mát, phục vụ các món Việt hiện đại kết hợp truyền thống.",
        "openTime": "10:00",
        "closeTime": "22:30",
        "phone": "0289876543",
        "featured": False,
        "totalSeats": 50,
        "availableSeats": 50,
        "managerID": manager1_id,
    },
    {
        "name": "Sushi Hokkaido Sachi",
        "address": "2A-4A Tôn Đức Thắng, Bến Nghé, Quận 1",
        "district": "Quận 3",
        "cuisine": "Nhật Bản",
        "priceRange": "500K - 1M",
        "rating": 4.8,
        "reviewCount": 432,
        "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
        "description": "Nhà hàng Nhật Bản cao cấp với nguyên liệu nhập khẩu trực tiếp từ Hokkaido. Sashimi và sushi tươi ngon hàng đầu.",
        "openTime": "11:00",
        "closeTime": "22:00",
        "phone": "0283456789",
        "featured": True,
        "totalSeats": 30,
        "availableSeats": 20,
        "managerID": manager2_id,
    },
    {
        "name": "Wrap & Roll",
        "address": "62 Hai Bà Trưng, Bến Nghé, Quận 1",
        "district": "Quận 1",
        "cuisine": "Việt Nam",
        "priceRange": "200K - 500K",
        "rating": 4.2,
        "reviewCount": 198,
        "imageUrl": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "description": "Wrap & Roll chuyên các món cuốn Việt Nam với hơn 30 loại nhân khác nhau. Không gian sang trọng và hiện đại.",
        "openTime": "10:00",
        "closeTime": "22:00",
        "phone": "0282345678",
        "featured": False,
        "totalSeats": 45,
        "availableSeats": 40,
        "managerID": manager2_id,
    },
]

created_restaurants = []
for r in restaurants_data:
    result = post("/api/create-restaurant/", r)
    if result:
        print(f"  Created restaurant: {result['name']} (id={result['restaurantId']})")
        created_restaurants.append(result)

# ─── 3. Menu Items ─────────────────────────────────────────
print("\n=== Creating Menu Items ===")

if created_restaurants:
    r1_id = created_restaurants[0]["restaurantId"]
    r2_id = created_restaurants[1]["restaurantId"]
    r3_id = created_restaurants[2]["restaurantId"]
    r4_id = created_restaurants[3]["restaurantId"] if len(created_restaurants) > 3 else r1_id
    r5_id = created_restaurants[4]["restaurantId"] if len(created_restaurants) > 4 else r2_id

    menu_items_data = [
        # Phở Thìn
        {"restaurantId": r1_id, "name": "Phở bò tái", "description": "Phở bò tái truyền thống", "price": 65000, "category": "Phở", "image": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400"},
        {"restaurantId": r1_id, "name": "Phở bò chín", "description": "Phở bò chín mềm", "price": 65000, "category": "Phở", "image": None},
        {"restaurantId": r1_id, "name": "Phở bò tái nạm", "description": "Phở bò tái nạm đặc biệt", "price": 75000, "category": "Phở", "image": None},
        {"restaurantId": r1_id, "name": "Trà đá", "description": "Trà đá miễn phí", "price": 0, "category": "Đồ uống", "image": None},

        # Cục Gạch Quán
        {"restaurantId": r2_id, "name": "Cơm tấm sườn", "description": "Cơm tấm sườn nướng than hoa", "price": 120000, "category": "Cơm", "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400"},
        {"restaurantId": r2_id, "name": "Bún chả Hà Nội", "description": "Bún chả với chả nướng thơm", "price": 95000, "category": "Bún", "image": None},
        {"restaurantId": r2_id, "name": "Gỏi cuốn tôm thịt", "description": "Gỏi cuốn tươi ngon", "price": 85000, "category": "Khai vị", "image": None},
        {"restaurantId": r2_id, "name": "Chè khúc bạch", "description": "Chè khúc bạch mát lạnh", "price": 45000, "category": "Tráng miệng", "image": None},

        # Pizza 4P's
        {"restaurantId": r3_id, "name": "Pizza Margherita", "description": "Pizza với phô mai mozzarella tự làm", "price": 189000, "category": "Pizza", "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400"},
        {"restaurantId": r3_id, "name": "Pizza Salmon", "description": "Pizza cá hồi hun khói", "price": 249000, "category": "Pizza", "image": None},
        {"restaurantId": r3_id, "name": "Pasta Carbonara", "description": "Pasta kem trứng kiểu Ý", "price": 179000, "category": "Pasta", "image": None},
        {"restaurantId": r3_id, "name": "Tiramisu", "description": "Tiramisu Ý truyền thống", "price": 89000, "category": "Tráng miệng", "image": None},

        # Quán Bụi
        {"restaurantId": r4_id, "name": "Bò lúc lắc", "description": "Bò Úc lúc lắc với khoai tây", "price": 195000, "category": "Món chính", "image": None},
        {"restaurantId": r4_id, "name": "Canh chua cá lóc", "description": "Canh chua truyền thống miền Tây", "price": 125000, "category": "Canh", "image": None},

        # Sushi Hokkaido
        {"restaurantId": r5_id, "name": "Sashimi tổng hợp", "description": "Combo sashimi 12 miếng", "price": 450000, "category": "Sashimi", "image": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400"},
        {"restaurantId": r5_id, "name": "Sushi set đặc biệt", "description": "Set 16 miếng sushi", "price": 380000, "category": "Sushi", "image": None},
        {"restaurantId": r5_id, "name": "Ramen tonkotsu", "description": "Mì ramen nước dùng xương heo", "price": 189000, "category": "Ramen", "image": None},
    ]

    for item in menu_items_data:
        result = post("/api/create-menuitem/", item)
        if result:
            print(f"  Created menu item: {result['name']} (restaurant {result['restaurantId']})")


# ─── 4. Bookings ───────────────────────────────────────────
print("\n=== Creating Bookings ===")

if created_restaurants:
    bookings_data = [
        {
            "userId": customer1_id,
            "restaurantId": r1_id,
            "date": "2026-03-15",
            "time": "12:00",
            "guestCount": 2,
            "requestSeats": 2,
            "contactName": "Lê Minh Châu",
            "contactEmail": "customer@tablenow.vn",
            "contactPhone": "0900000004",
            "note": "Bàn gần cửa sổ nếu có",
        },
        {
            "userId": customer1_id,
            "restaurantId": r2_id,
            "date": "2026-03-15",
            "time": "19:00",
            "guestCount": 4,
            "requestSeats": 4,
            "contactName": "Lê Minh Châu",
            "contactEmail": "customer@tablenow.vn",
            "contactPhone": "0900000004",
            "note": "Sinh nhật bạn",
        },
        {
            "userId": customer2_id,
            "restaurantId": r3_id,
            "date": "2026-03-14",
            "time": "18:30",
            "guestCount": 6,
            "requestSeats": 6,
            "contactName": "Phạm Đức Dũng",
            "contactEmail": "customer2@tablenow.vn",
            "contactPhone": "0900000005",
            "note": "",
        },
        {
            "userId": customer2_id,
            "restaurantId": r1_id,
            "date": "2026-03-16",
            "time": "11:30",
            "guestCount": 3,
            "requestSeats": 3,
            "contactName": "Phạm Đức Dũng",
            "contactEmail": "customer2@tablenow.vn",
            "contactPhone": "0900000005",
            "note": "Ăn trưa công ty",
        },
        {
            "userId": customer1_id,
            "restaurantId": r5_id,
            "date": "2026-03-17",
            "time": "19:00",
            "guestCount": 2,
            "requestSeats": 2,
            "contactName": "Lê Minh Châu",
            "contactEmail": "customer@tablenow.vn",
            "contactPhone": "0900000004",
            "note": "Kỷ niệm",
        },
    ]

    created_bookings = []
    for b in bookings_data:
        result = post("/api/create-booking/", b)
        if result:
            print(f"  Created booking #{result['bookingId']}: user {result['userId']} → restaurant {result['restaurantId']} ({result['status']})")
            created_bookings.append(result)

    # Confirm the first booking to test seat deduction
    if len(created_bookings) >= 2:
        print("\n=== Confirming first booking ===")
        result = put(f"/api/bookings/{created_bookings[0]['bookingId']}/confirm")
        if result:
            print(f"  Confirmed booking #{created_bookings[0]['bookingId']}: {result.get('message', '')}")
            print(f"  Restaurant available seats: {result.get('restaurant_available_seats', '?')}")


# ─── Summary ───────────────────────────────────────────────
print("\n" + "=" * 50)
print("SEED COMPLETE!")
print("=" * 50)
print("\nTest accounts:")
print("  Admin:    admin@tablenow.vn    / admin123")
print("  Manager:  manager@tablenow.vn  / manager123")
print("  Manager2: manager2@tablenow.vn / manager123")
print("  Customer: customer@tablenow.vn / customer123")
print("  Customer2:customer2@tablenow.vn/ customer123")
print()

# Verify final counts
try:
    users = get("/api/get-all-user/")
    restaurants = get("/api/get-all-restaurant/")
    bookings = get("/api/get-all-booking/")
    print(f"Database totals:")
    print(f"  Users:       {len(users)}")
    print(f"  Restaurants: {len(restaurants)}")
    print(f"  Bookings:    {len(bookings)}")
except Exception as e:
    print(f"  Could not verify: {e}")
