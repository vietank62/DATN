"""Seed 20 active demo restaurants and their manager accounts.

Run from backend-python:
    .\\.venv313\\Scripts\\python.exe scripts\\seed_demo_restaurants.py

The script is idempotent: it updates the 20 restaurants identified by their
slugs and creates any menu item that is missing. It never removes other data.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

from sqlalchemy import func
from sqlmodel import Session, select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from core.security import get_password_hash
from database import engine, redis_client
from models import Favorite, Restaurant, RestaurantDetail, RestaurantMenuList, Review, User
from models.bookingItem import BookingItem


# Register the model referenced by Booking.relationship("BookingItem") when this
# script is run directly rather than through the FastAPI application.
_ = BookingItem


DEFAULT_PASSWORD = "Manager@2026"
IMAGE_BASE = "https://images.unsplash.com"


RESTAURANTS = [
    ("Lẩu Song Hỷ Quận 1", "lau-song-hy-quan-1", "lau", "Quận 1", "Hồ Chí Minh", "58 Nguyễn Thái Học", 320000, True),
    ("Nướng Phố Seoul", "nuong-pho-seoul-quan-3", "nuong", "Quận 3", "Hồ Chí Minh", "210 Võ Văn Tần", 280000, True),
    ("Buffet Vườn Mây", "buffet-vuon-may-quan-7", "buffet", "Quận 7", "Hồ Chí Minh", "18 Nguyễn Hữu Thọ", 390000, False),
    ("Hải Sản Biển Xanh", "hai-san-bien-xanh-quan-4", "hai-san", "Quận 4", "Hồ Chí Minh", "77 Bến Vân Đồn", 450000, True),
    ("Sushi Kiku", "sushi-kiku-binh-thanh", "mon-nhat", "Quận Bình Thạnh", "Hồ Chí Minh", "125 Điện Biên Phủ", 520000, False),
    ("Bếp Việt Nhà Mình", "bep-viet-nha-minh-quan-5", "mon-viet", "Quận 5", "Hồ Chí Minh", "42 Trần Hưng Đạo", 180000, True),
    ("Pizza Gỗ Ý", "pizza-go-y-thu-duc", "pizza", "Thành phố Thủ Đức", "Hồ Chí Minh", "15 Võ Văn Ngân", 260000, False),
    ("Chay An Nhiên", "chay-an-nhien-phu-nhuan", "mon-chay", "Quận Phú Nhuận", "Hồ Chí Minh", "89 Phan Xích Long", 150000, True),
    ("Steakhouse Prime", "steakhouse-prime-tan-binh", "steak", "Quận Tân Bình", "Hồ Chí Minh", "31 Hoàng Văn Thụ", 650000, False),
    ("Dimsum Hồng Kông", "dimsum-hong-kong-quan-10", "mon-trung", "Quận 10", "Hồ Chí Minh", "360 Sư Vạn Hạnh", 220000, True),
    ("Lẩu Cua Phố Cổ", "lau-cua-pho-co-hoan-kiem", "lau", "Quận Hoàn Kiếm", "Hà Nội", "12 Hàng Bè", 360000, True),
    ("Nướng Than Hoa", "nuong-than-hoa-cau-giay", "nuong", "Quận Cầu Giấy", "Hà Nội", "99 Trần Thái Tông", 290000, False),
    ("Bếp Bắc Truyền Thống", "bep-bac-truyen-thong-ba-dinh", "mon-viet", "Quận Ba Đình", "Hà Nội", "25 Liễu Giai", 240000, True),
    ("Sushi Edo", "sushi-edo-tay-ho", "mon-nhat", "Quận Tây Hồ", "Hà Nội", "8 Xuân Diệu", 580000, False),
    ("Nhà Hàng Thái Lan Sawasdee", "thai-lan-sawasdee-dong-da", "mon-thai", "Quận Đống Đa", "Hà Nội", "172 Thái Hà", 270000, True),
    ("Hải Sản Sông Hàn", "hai-san-song-han-hai-chau", "hai-san", "Quận Hải Châu", "Đà Nẵng", "66 Bạch Đằng", 410000, True),
    ("Buffet Vị Biển", "buffet-vi-bien-son-tra", "buffet", "Quận Sơn Trà", "Đà Nẵng", "122 Võ Nguyên Giáp", 350000, False),
    ("Mì Quảng Bà Lan", "mi-quang-ba-lan-cam-le", "dac-san", "Quận Cẩm Lệ", "Đà Nẵng", "70 Cách Mạng Tháng Tám", 120000, True),
    ("Pizza Napoli Đà Nẵng", "pizza-napoli-ngu-hanh-son", "pizza", "Quận Ngũ Hành Sơn", "Đà Nẵng", "39 An Thượng 4", 230000, False),
    ("Chay Lá Bồ Đề", "chay-la-bo-de-thanh-khe", "mon-chay", "Quận Thanh Khê", "Đà Nẵng", "101 Điện Biên Phủ", 140000, True),
]


def image_url(photo_id: str, width: int = 1200) -> str:
    return f"{IMAGE_BASE}/photo-{photo_id}?auto=format&fit=crop&w={width}&q=85"


GALLERY_IMAGES = [
    image_url("1515003197210-e0cd71810b5f"),
    image_url("1517248135467-4c7edcad34c4"),
    image_url("1552566626-52f8b828add9"),
    image_url("1414235077428-338989a2e8c0"),
]


MENU_BY_CATEGORY: dict[str, list[tuple[str, str, int, str]]] = {
    "lau": [
        ("Lẩu Thái hải sản", "Lẩu", 329000, "Nước lẩu chua cay, tôm, mực và rau tươi."),
        ("Lẩu nấm thanh ngọt", "Lẩu", 289000, "Nước dùng rau củ, nấm tươi theo mùa."),
        ("Bò Mỹ nhúng lẩu", "Gọi thêm", 129000, "Ba chỉ bò Mỹ thái mỏng."),
        ("Viên thả lẩu tổng hợp", "Gọi thêm", 79000, "Chả cá, bò viên và tôm viên."),
        ("Rau xanh theo mùa", "Gọi thêm", 49000, "Rau tươi chọn lọc mỗi ngày."),
        ("Mì trứng", "Gọi thêm", 25000, "Mì trứng thủ công."),
    ],
    "nuong": [
        ("Ba chỉ bò Mỹ sốt cay", "Nướng", 159000, "Bò Mỹ ướp sốt cay Hàn Quốc."),
        ("Sườn heo mật ong", "Nướng", 139000, "Sườn non nướng than hoa."),
        ("Bạch tuộc sa tế", "Hải sản nướng", 149000, "Bạch tuộc tươi giòn, sốt sa tế."),
        ("Cơm trộn Hàn Quốc", "Món chính", 89000, "Cơm trộn rau củ và trứng lòng đào."),
        ("Canh kim chi", "Món phụ", 69000, "Canh kim chi cay nhẹ."),
        ("Panchan tổng hợp", "Món phụ", 49000, "Bốn món ăn kèm thay đổi theo ngày."),
    ],
    "hai-san": [
        ("Tôm hùm nướng phô mai", "Hải sản", 690000, "Tôm hùm nướng phô mai béo ngậy."),
        ("Cua rang me", "Hải sản", 420000, "Cua thịt tươi sốt me chua ngọt."),
        ("Hàu nướng mỡ hành", "Hải sản", 129000, "Hàu sữa nướng thơm béo."),
        ("Mực một nắng nướng", "Hải sản", 189000, "Mực một nắng tẩm gia vị."),
        ("Cơm chiên hải sản", "Món chính", 109000, "Cơm chiên tôm mực và rau củ."),
        ("Canh chua cá", "Món phụ", 99000, "Canh chua Nam Bộ đậm vị."),
    ],
    "mon-nhat": [
        ("Sashimi cá hồi", "Sashimi", 249000, "Cá hồi Na Uy tươi cắt lát."),
        ("Sushi cá ngừ", "Sushi", 159000, "Sushi cá ngừ và cơm giấm Nhật."),
        ("Cuộn California", "Sushi", 149000, "Thanh cua, bơ và trứng cá."),
        ("Ramen Tonkotsu", "Món nóng", 179000, "Mì ramen nước hầm xương heo."),
        ("Gà Karaage", "Món nóng", 119000, "Gà chiên kiểu Nhật giòn rụm."),
        ("Mochi trà xanh", "Tráng miệng", 69000, "Bánh mochi nhân kem trà xanh."),
    ],
    "buffet": [
        ("Buffet trưa", "Vé buffet", 299000, "Không giới hạn 90 phút, áp dụng thứ Hai đến Sáu."),
        ("Buffet tối", "Vé buffet", 399000, "Không giới hạn 120 phút, bao gồm hải sản."),
        ("Set đồ nướng đặc biệt", "Quầy line", 0, "Nằm trong vé buffet tối."),
        ("Quầy sushi", "Quầy line", 0, "Sushi và sashimi theo ngày."),
        ("Quầy tráng miệng", "Quầy line", 0, "Bánh ngọt, trái cây và kem."),
        ("Nước ngọt tự chọn", "Đồ uống", 39000, "Nước ngọt dùng không giới hạn."),
    ],
    "mon-viet": [
        ("Chả giò hải sản", "Khai vị", 89000, "Chả giò chiên vàng giòn."),
        ("Cá kho tộ", "Món chính", 159000, "Cá lóc kho trong niêu đất."),
        ("Gà nướng lu", "Món chính", 229000, "Gà ta nướng thơm da giòn."),
        ("Canh chua bông điên điển", "Canh", 99000, "Canh chua cá và bông điên điển."),
        ("Rau luộc kho quẹt", "Món phụ", 79000, "Rau củ theo mùa cùng kho quẹt."),
        ("Chè ba màu", "Tráng miệng", 39000, "Chè ba màu nước cốt dừa."),
    ],
}


DEFAULT_MENU = [
    ("Khai vị tổng hợp", "Khai vị", 99000, "Món khai vị dùng chung."),
    ("Món đặc biệt nhà hàng", "Món chính", 189000, "Món đặc trưng được yêu thích."),
    ("Salad theo mùa", "Món phụ", 79000, "Rau củ tươi theo mùa."),
    ("Súp hải sản", "Món phụ", 89000, "Súp hải sản nóng hổi."),
    ("Cơm chiên", "Món chính", 99000, "Cơm chiên rau củ."),
    ("Bánh ngọt", "Tráng miệng", 59000, "Bánh ngọt thủ công."),
]


def menu_for(category: str) -> list[tuple[str, str, int, str]]:
    if category in {"pizza", "steak", "mon-thai", "mon-trung", "mon-chay", "dac-san"}:
        return DEFAULT_MENU
    return MENU_BY_CATEGORY.get(category, DEFAULT_MENU)


def upsert_user(session: Session, index: int) -> User:
    email = f"manager.demo{index:02d}@tablenow.local"
    user = session.exec(select(User).where(User.email == email)).first()

    if user is None:
        user = User(
            name=f"Quản lý mẫu {index:02d}",
            email=email,
            phone=f"090900{index:04d}",
            password=get_password_hash(DEFAULT_PASSWORD),
            role="manager",
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
        session.add(user)
        session.flush()
    else:
        user.name = f"Quản lý mẫu {index:02d}"
        user.role = "manager"
        session.add(user)

    return user


def upsert_restaurant(session: Session, index: int, data: tuple[str, str, str, str, str, str, int, bool], manager: User) -> Restaurant:
    name, slug, category, district, city, address, price_avg, has_exclusive = data
    restaurant = session.exec(select(Restaurant).where(Restaurant.slug == slug)).first()
    capacity = 50 + (index % 5) * 30

    payload = {
        "name": name,
        "slug": slug,
        "image_url": GALLERY_IMAGES[index % len(GALLERY_IMAGES)],
        "address": address,
        "district": district,
        "city": city,
        "price_avg": price_avg,
        "has_exclusive": has_exclusive,
        "category": [category],
        "suitable_for": ["gia-dinh", "ban-be"] if index % 2 else ["hen-ho", "sinh-nhat"],
        "service_types": ["phuc-vu-tai-ban"] if index % 3 else ["quay-line", "tu-phuc-vu"],
        "capacity": capacity,
        "is_active": True,
        "approval_status": "approved",
        "business_license_url": f"https://placehold.co/1200x800/png?text=Business+License+{index:02d}",
        "tax_code": f"031{index:07d}",
        "legal_documents_url": f"https://placehold.co/1200x800/pdf?text=Legal+Document+{index:02d}",
        "policy_accepted_at": datetime.now(timezone.utc),
        "booking_opening_time": "10:00",
        "booking_closing_time": "21:30",
        "manager_id": manager.userId,
    }

    if restaurant is None:
        restaurant = Restaurant(**payload)
    else:
        for field, value in payload.items():
            setattr(restaurant, field, value)

    session.add(restaurant)
    session.flush()
    return restaurant


def sync_engagement_stats(session: Session, restaurant: Restaurant) -> None:
    """Keep denormalized stats equal to real favorites and real reviews only."""
    like_count = session.exec(
        select(func.count()).select_from(Favorite).where(
            Favorite.restaurantId == restaurant.id
        )
    ).one()
    review_count, average_rating = session.exec(
        select(func.count(Review.reviewId), func.avg(Review.rating)).where(
            Review.restaurantId == restaurant.id
        )
    ).one()

    restaurant.like_count = int(like_count or 0)
    restaurant.review_count = int(review_count or 0)
    restaurant.rating = round(float(average_rating), 1) if average_rating else 0.0
    session.add(restaurant)


def upsert_detail(session: Session, restaurant: Restaurant, index: int) -> None:
    detail = session.exec(
        select(RestaurantDetail).where(RestaurantDetail.restaurant_id == restaurant.id)
    ).first()
    gallery = [
        GALLERY_IMAGES[index % len(GALLERY_IMAGES)],
        GALLERY_IMAGES[(index + 1) % len(GALLERY_IMAGES)],
        GALLERY_IMAGES[(index + 2) % len(GALLERY_IMAGES)],
    ]
    payload = {
        "image_urls": gallery,
        "image_menu": [GALLERY_IMAGES[(index + 3) % len(GALLERY_IMAGES)]],
        "price_range": f"{max(50000, restaurant.price_avg - 100000):,}đ - {restaurant.price_avg + 250000:,}đ",
        "phone_number": f"028 7300 {1000 + index:04d}",
        "description": f"{restaurant.name} phục vụ không gian chỉn chu, nguyên liệu tươi và thực đơn đa dạng. Phù hợp cho gia đình, bạn bè, hẹn hò và các buổi gặp gỡ.",
        "opening_time": ["10:00", "22:30"],
        "parking_info": "Có chỗ gửi xe máy; ô tô vui lòng liên hệ trước để được hướng dẫn.",
        "utilities": [5, 6, 7, 10, 13, 15, 20] if index % 2 else [3, 5, 6, 8, 10, 14, 15, 18],
        "regulations": "Vui lòng đến đúng giờ đặt bàn. Giữ bàn tối đa 15 phút; không mang đồ ăn, thức uống bên ngoài.",
        "requires_deposit": index % 4 == 0,
    }

    if detail is None:
        detail = RestaurantDetail(restaurant_id=restaurant.id, **payload)
    else:
        for field, value in payload.items():
            setattr(detail, field, value)

    session.add(detail)


def add_missing_menu_items(session: Session, restaurant: Restaurant, category: str, index: int) -> int:
    existing_names = set(
        session.exec(
            select(RestaurantMenuList.name).where(
                RestaurantMenuList.restaurant_id == restaurant.id
            )
        ).all()
    )
    created = 0

    for item_index, (name, menu_category, price, description) in enumerate(menu_for(category)):
        if name in existing_names:
            continue
        session.add(
            RestaurantMenuList(
                restaurant_id=restaurant.id,
                name=name,
                category=menu_category,
                price=price,
                description=description,
                image_url=GALLERY_IMAGES[(index + item_index) % len(GALLERY_IMAGES)],
                is_available=True,
            )
        )
        created += 1
    return created


async def clear_restaurant_list_cache() -> None:
    """Remove cached restaurant lists so the demo records appear immediately."""
    cache_key_set = "cache:restaurants:keys"
    try:
        cache_keys = await redis_client.smembers(cache_key_set)
        if cache_keys:
            await redis_client.delete(*cache_keys)
        await redis_client.delete(cache_key_set)
        print("Cleared restaurant-list cache.")
    except Exception as error:
        print(f"Could not clear Redis cache: {error}")


def main() -> None:
    created_menu_items = 0
    seeded_slugs = [restaurant[1] for restaurant in RESTAURANTS]

    with Session(engine) as session:
        for index, restaurant_data in enumerate(RESTAURANTS, start=1):
            manager = upsert_user(session, index)
            restaurant = upsert_restaurant(session, index, restaurant_data, manager)
            sync_engagement_stats(session, restaurant)
            upsert_detail(session, restaurant, index)
            created_menu_items += add_missing_menu_items(
                session,
                restaurant,
                restaurant_data[2],
                index,
            )

        session.commit()

        demo_restaurants = session.exec(
            select(Restaurant).where(Restaurant.slug.in_(seeded_slugs))
        ).all()
        restaurant_ids = [restaurant.id for restaurant in demo_restaurants]
        demo_managers = session.exec(
            select(User).where(User.email.like("manager.demo%@tablenow.local"))
        ).all()
        detail_count = len(
            session.exec(
                select(RestaurantDetail).where(
                    RestaurantDetail.restaurant_id.in_(restaurant_ids)
                )
            ).all()
        )
        menu_count = len(
            session.exec(
                select(RestaurantMenuList).where(
                    RestaurantMenuList.restaurant_id.in_(restaurant_ids)
                )
            ).all()
        )

    asyncio.run(clear_restaurant_list_cache())
    print(
        "Seed verification: "
        f"{len(demo_managers)} managers, "
        f"{len(demo_restaurants)} restaurants, "
        f"{detail_count} restaurant details, "
        f"{menu_count} menu items."
    )
    print(f"Added {created_menu_items} missing menu items.")
    print(f"Manager login password for demo accounts: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()
