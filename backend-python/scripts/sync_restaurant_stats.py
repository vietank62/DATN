import os
import sys
import asyncio
import random

# Add backend root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy import func
from database import engine
import models

async def sync_restaurant_stats():
    print("=== STARTING RESTAURANT DATA STATS & PROMO SYNC ===")
    
    # Beautiful mock promotions for demo
    promo_list = [
        "Giảm 10% khi đặt bàn trước qua TableNow",
        "Tặng 1 đĩa khai vị đặc sắc cho nhóm 4 người",
        "Giảm 15% tổng hóa đơn cho tiệc sinh nhật",
        "Tặng nước ngọt hoặc trà đá miễn phí",
        "Buffet đi 4 tính tiền 3 (áp dụng T2-T5)",
        "Tặng bánh ngọt tráng miệng cho mỗi khách"
    ]
    
    async with AsyncSession(engine) as session:
        res = await session.execute(select(models.Restaurant))
        restaurants = res.scalars().all()
        print(f"Scanning {len(restaurants)} restaurants in database...")
        
        for idx, r in enumerate(restaurants):
            print(f"\nSyncing: {r.name} (ID: {r.restaurantId})")
            
            # 1. Rating and reviewCount calculation
            review_res = await session.execute(
                select(
                    func.count(models.Review.reviewId),
                    func.avg(models.Review.rating)
                ).where(models.Review.restaurantId == r.restaurantId)
            )
            count_val, avg_val = review_res.first()
            if count_val:
                r.reviewCount = count_val
                r.rating = round(avg_val, 1)
                print(f"  -> Found {count_val} reviews, average rating: {r.rating}")
            else:
                # Seed random ratings for beautiful homepage collections
                r.rating = round(random.uniform(4.5, 4.9), 1) if r.featured else round(random.uniform(4.0, 4.4), 1)
                r.reviewCount = random.randint(15, 120)
                print(f"  -> No reviews. Seeded random rating: {r.rating} ({r.reviewCount} reviews)")
                
            # 2. priceRange calculation
            price_res = await session.execute(
                select(
                    func.min(models.MenuItem.price),
                    func.max(models.MenuItem.price)
                ).where(models.MenuItem.restaurantId == r.restaurantId)
            )
            min_price, max_price = price_res.first()
            if min_price is not None and max_price is not None:
                if min_price == max_price:
                    r.priceRange = f"{int(min_price):,}đ"
                else:
                    r.priceRange = f"{int(min_price):,}đ - {int(max_price):,}đ"
                print(f"  -> Computed price range from menu: {r.priceRange}")
            else:
                # Seed random price range
                min_p = random.choice([50000, 85000, 150000, 220000])
                max_p = min_p + random.choice([40000, 80000, 180000])
                r.priceRange = f"{int(min_p):,}đ - {int(max_p):,}đ"
                print(f"  -> No menu items. Seeded random price range: {r.priceRange}")
                
            # 3. Seeding promotions (for 50% of the restaurants)
            if idx % 2 == 0:
                r.promotion = promo_list[idx % len(promo_list)]
                print(f"  -> Assigned promotion: {r.promotion}")
            else:
                r.promotion = None
                print("  -> No promotion assigned")
                
            session.add(r)
            
        await session.commit()
        print("\n=== DATA STATS & PROMO SYNC COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(sync_restaurant_stats())
