import sys
import os
from datetime import datetime

# Thêm thư mục gốc vào sys.path để có thể import các module từ thư mục cha
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select, text
from database import engine
from models import User, Restaurant, MenuItem, Booking
from routers.user import get_password_hash

def seed_database():
    with Session(engine) as session:
        print("=== 🧹 Đang dọn dẹp dữ liệu cũ (Xoá toàn bộ dữ liệu) ===")
        try:
            # Tự động thêm cột cuisines nếu DB chưa update
            session.exec(text('ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS cuisines JSON;'))
            session.exec(text('TRUNCATE TABLE "booking", "menuitem", "restaurant", "user" RESTART IDENTITY CASCADE;'))
            session.commit()
            print("  Đã dọn dẹp xong!")
        except Exception as e:
            print(f"  Lỗi khi dọn dẹp: {e}")
            session.rollback()

        print("\n=== 👥 Đang tạo Users ===")
        users_data = [
            {"name": "Admin User", "email": "admin@tablenow.vn", "phone": "0900000001", "password": "admin123", "role": "admin"},
            {"name": "Nguyễn Văn An", "email": "manager@tablenow.vn", "phone": "0900000002", "password": "manager123", "role": "manager"},
            {"name": "Trần Thị Bình", "email": "manager2@tablenow.vn", "phone": "0900000003", "password": "manager123", "role": "manager"},
            {"name": "Lê Minh Châu", "email": "customer@tablenow.vn", "phone": "0900000004", "password": "customer123", "role": "customer"},
            {"name": "Phạm Đức Dũng", "email": "customer2@tablenow.vn", "phone": "0900000005", "password": "customer123", "role": "customer"},
        ]

        users = {}
        for u_data in users_data:
            user = User(
                name=u_data["name"],
                email=u_data["email"],
                phone=u_data["phone"],
                password=get_password_hash(u_data["password"]),
                role=u_data["role"],
                createdAt=datetime.now().isoformat(timespec="seconds")
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            users[u_data["email"]] = user
            print(f"  Đã tạo User: {user.name}")

        print("\n=== 🍽️ Đang tạo 34 Restaurants ===")
        m1 = users["manager@tablenow.vn"]
        m2 = users["manager2@tablenow.vn"]

        restaurants_data = [
            # 4 Original Restaurants
            {
                "name": "Phở Thìn Bờ Hồ", "address": "13 Lò Đúc, Hai Bà Trưng", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "Dưới 200K", "rating": 4.7, "reviewCount": 328,
                "imageUrl": "https://images.unsplash.com/photo-1503764654157-72d979d9af2f?w=800",
                "description": "Phở Thìn nổi tiếng với nước dùng đậm đà, thịt bò tươi ngon.",
                "openTime": "06:00", "closeTime": "22:00", "phone": "0901234567",
                "featured": True, "totalSeats": 40, "availableSeats": 35, "managerID": m1.userId,
            },
            {
                "name": "Nhà hàng Cục Gạch Quán", "address": "10 Đặng Tất, Tân Định", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.5, "reviewCount": 512,
                "imageUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                "description": "Cục Gạch Quán mang đến không gian ấm cúng với kiến trúc nhà cổ Sài Gòn.",
                "openTime": "10:00", "closeTime": "23:00", "phone": "0287654321",
                "featured": True, "totalSeats": 60, "availableSeats": 45, "managerID": m1.userId,
            },
            {
                "name": "Pizza 4P's", "address": "8 Thủ Khoa Huân, Bến Thành", "district": "Quận 1", "cuisine": "Ý",
                "priceRange": "200K - 500K", "rating": 4.6, "reviewCount": 876,
                "imageUrl": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800",
                "description": "Pizza 4P's nổi tiếng với pizza nướng lò củi và phô mai tự làm.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "0281234568",
                "featured": True, "totalSeats": 80, "availableSeats": 60, "managerID": m2.userId,
            },
            {
                "name": "Sushi Hokkaido Sachi", "address": "2A-4A Tôn Đức Thắng", "district": "Quận 1", "cuisine": "Nhật Bản",
                "priceRange": "500K - 1M", "rating": 4.8, "reviewCount": 432,
                "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
                "description": "Nhà hàng Nhật Bản cao cấp với nguyên liệu nhập khẩu trực tiếp từ Hokkaido.",
                "openTime": "11:00", "closeTime": "22:00", "phone": "0283456789",
                "featured": True, "totalSeats": 30, "availableSeats": 20, "managerID": m2.userId,
            },
            # 30 New Restaurants
            {
                "name": "Haidilao Hot Pot", "address": "Tầng 3, Bitexco Financial Tower", "district": "Quận 1", "cuisine": "Trung Quốc",
                "priceRange": "500K - 1M", "rating": 4.9, "reviewCount": 1500,
                "imageUrl": "https://images.unsplash.com/photo-1563379926898-05f45c514d68?w=800",
                "description": "Thương hiệu lẩu nổi tiếng với dịch vụ chăm sóc khách hàng đỉnh cao và hương vị lẩu Tứ Xuyên đặc trưng.",
                "openTime": "10:00", "closeTime": "02:00", "phone": "02811112222",
                "featured": True, "totalSeats": 120, "availableSeats": 100, "managerID": m1.userId,
            },
            {
                "name": "Manwah Taiwanese Hotpot", "address": "Tầng 5, Saigon Centre", "district": "Quận 1", "cuisine": "Đài Loan",
                "priceRange": "200K - 500K", "rating": 4.6, "reviewCount": 850,
                "imageUrl": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800",
                "description": "Lẩu Đài Loan truyền thống với nước lẩu thanh ngọt và thịt bò hảo hạng.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02833334444",
                "featured": False, "totalSeats": 80, "availableSeats": 40, "managerID": m2.userId,
            },
            {
                "name": "Gogi House", "address": "123 Nguyễn Thái Học", "district": "Quận 1", "cuisine": "Hàn Quốc",
                "priceRange": "200K - 500K", "rating": 4.5, "reviewCount": 1200,
                "imageUrl": "https://images.unsplash.com/photo-1544025162-831550fe1db9?w=800",
                "description": "Thịt nướng Hàn Quốc chuẩn vị ngon số 1 với không gian trẻ trung.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02855556666",
                "featured": True, "totalSeats": 100, "availableSeats": 50, "managerID": m1.userId,
            },
            {
                "name": "El Gaucho Argentinian Steakhouse", "address": "74/1 Hai Bà Trưng", "district": "Quận 1", "cuisine": "Âu",
                "priceRange": "Trên 1M", "rating": 4.8, "reviewCount": 650,
                "imageUrl": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800",
                "description": "Nhà hàng bít tết chuẩn vị Argentina cao cấp nhất Sài Gòn.",
                "openTime": "11:00", "closeTime": "23:00", "phone": "02877778888",
                "featured": True, "totalSeats": 60, "availableSeats": 20, "managerID": m2.userId,
            },
            {
                "name": "San Fu Lou", "address": "Tầng trệt, AB Tower", "district": "Quận 1", "cuisine": "Trung Quốc",
                "priceRange": "200K - 500K", "rating": 4.4, "reviewCount": 420,
                "imageUrl": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800",
                "description": "Ẩm thực Quảng Đông đương đại với không gian bếp mở độc đáo.",
                "openTime": "07:00", "closeTime": "03:00", "phone": "02899990000",
                "featured": False, "totalSeats": 90, "availableSeats": 60, "managerID": m1.userId,
            },
            {
                "name": "Som Tum Thai", "address": "Tầng 5, Estella Place", "district": "Quận 2", "cuisine": "Thái Lan",
                "priceRange": "200K - 500K", "rating": 4.3, "reviewCount": 310,
                "imageUrl": "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800",
                "description": "Hương vị ẩm thực Thái Lan cay nồng đúng chuẩn truyền thống.",
                "openTime": "10:30", "closeTime": "22:00", "phone": "02812341234",
                "featured": False, "totalSeats": 70, "availableSeats": 50, "managerID": m2.userId,
            },
            {
                "name": "The Deck Saigon", "address": "38 Nguyễn Ư Dĩ, Thảo Điền", "district": "Quận 2", "cuisine": "Âu",
                "priceRange": "500K - 1M", "rating": 4.7, "reviewCount": 980,
                "imageUrl": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
                "description": "Nhà hàng ven sông Sài Gòn mang lại không gian lãng mạn cho các cặp đôi.",
                "openTime": "08:00", "closeTime": "00:00", "phone": "02845674567",
                "featured": True, "totalSeats": 120, "availableSeats": 80, "managerID": m1.userId,
            },
            {
                "name": "Yen Sushi & Sake Pub", "address": "15 Lê Quý Đôn", "district": "Quận 3", "cuisine": "Nhật Bản",
                "priceRange": "500K - 1M", "rating": 4.6, "reviewCount": 540,
                "imageUrl": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800",
                "description": "Trải nghiệm ẩm thực Nhật Bản hiện đại kết hợp với không gian Pub sôi động.",
                "openTime": "10:30", "closeTime": "23:00", "phone": "02856785678",
                "featured": False, "totalSeats": 80, "availableSeats": 40, "managerID": m2.userId,
            },
            {
                "name": "Quán Ngon 138", "address": "138 Nam Kỳ Khởi Nghĩa", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.4, "reviewCount": 1100,
                "imageUrl": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800",
                "description": "Tập hợp các món ăn 3 miền Việt Nam trong không gian nhà rường cổ kính.",
                "openTime": "06:30", "closeTime": "22:30", "phone": "02867896789",
                "featured": True, "totalSeats": 150, "availableSeats": 100, "managerID": m1.userId,
            },
            {
                "name": "Noir. Dining in the Dark", "address": "178-180D Hai Bà Trưng", "district": "Quận 1", "cuisine": "Á - Âu",
                "priceRange": "500K - 1M", "rating": 4.8, "reviewCount": 720,
                "imageUrl": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
                "description": "Trải nghiệm thưởng thức món ăn trong bóng tối hoàn toàn độc nhất vô nhị.",
                "openTime": "11:30", "closeTime": "23:00", "phone": "02878907890",
                "featured": True, "totalSeats": 40, "availableSeats": 15, "managerID": m2.userId,
            },
            {
                "name": "Chảo Cá", "address": "Tầng 5, Vincom Mega Mall Thảo Điền", "district": "Quận 2", "cuisine": "Việt Nam",
                "priceRange": "Dưới 200K", "rating": 4.2, "reviewCount": 215,
                "imageUrl": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800",
                "description": "Các món cá chẽm, cá lăng tươi ngon chế biến trên chảo nóng hổi.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02811122233",
                "featured": False, "totalSeats": 60, "availableSeats": 60, "managerID": m1.userId,
            },
            {
                "name": "Shri Restaurant & Lounge", "address": "Tầng 23, Centec Tower", "district": "Quận 3", "cuisine": "Âu",
                "priceRange": "Trên 1M", "rating": 4.7, "reviewCount": 890,
                "imageUrl": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
                "description": "Nhà hàng rooftop với tầm nhìn toàn cảnh thành phố rực rỡ về đêm.",
                "openTime": "15:00", "closeTime": "00:00", "phone": "02822233344",
                "featured": True, "totalSeats": 100, "availableSeats": 40, "managerID": m2.userId,
            },
            {
                "name": "Baozi", "address": "165 Nguyễn Thái Học", "district": "Quận 1", "cuisine": "Đài Loan",
                "priceRange": "Dưới 200K", "rating": 4.5, "reviewCount": 670,
                "imageUrl": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800",
                "description": "Bánh bao kẹp thịt Đài Loan và các món ăn đường phố cách điệu.",
                "openTime": "10:00", "closeTime": "00:00", "phone": "02833344455",
                "featured": False, "totalSeats": 50, "availableSeats": 20, "managerID": m1.userId,
            },
            {
                "name": "Dim Tu Tac", "address": "55 Đông Du", "district": "Quận 1", "cuisine": "Trung Quốc",
                "priceRange": "200K - 500K", "rating": 4.6, "reviewCount": 450,
                "imageUrl": "https://images.unsplash.com/photo-1563379926898-05f45c514d68?w=800",
                "description": "Dimsum và các món vịt quay Bắc Kinh hảo hạng chuẩn vị.",
                "openTime": "08:00", "closeTime": "22:00", "phone": "02844455566",
                "featured": False, "totalSeats": 80, "availableSeats": 30, "managerID": m2.userId,
            },
            {
                "name": "Moo Beef Steak", "address": "109 Lý Tự Trọng", "district": "Quận 1", "cuisine": "Âu",
                "priceRange": "500K - 1M", "rating": 4.5, "reviewCount": 380,
                "imageUrl": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800",
                "description": "Không gian miền viễn Tây nước Mỹ với các món bít tết hảo hạng.",
                "openTime": "10:30", "closeTime": "22:30", "phone": "02855566677",
                "featured": False, "totalSeats": 70, "availableSeats": 50, "managerID": m1.userId,
            },
            {
                "name": "Bếp Mẹ Ỉn", "address": "136/9 Lê Thánh Tôn", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "Dưới 200K", "rating": 4.8, "reviewCount": 1250,
                "imageUrl": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800",
                "description": "Quán ăn nép mình trong hẻm nhỏ với món bánh xèo nổi tiếng được Michelin giới thiệu.",
                "openTime": "10:30", "closeTime": "22:30", "phone": "02866677788",
                "featured": True, "totalSeats": 45, "availableSeats": 10, "managerID": m2.userId,
            },
            {
                "name": "Secret Garden", "address": "158 Bis/40-41 Pasteur", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "Dưới 200K", "rating": 4.4, "reviewCount": 840,
                "imageUrl": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
                "description": "Khu vườn bí mật trên sân thượng giữa lòng thành phố với mâm cơm nhà chuẩn vị.",
                "openTime": "11:00", "closeTime": "22:00", "phone": "02877788899",
                "featured": False, "totalSeats": 60, "availableSeats": 20, "managerID": m1.userId,
            },
            {
                "name": "TukTuk Thai Bistro", "address": "17/11 Lê Thánh Tôn", "district": "Quận 1", "cuisine": "Thái Lan",
                "priceRange": "200K - 500K", "rating": 4.5, "reviewCount": 560,
                "imageUrl": "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800",
                "description": "Bistro mang phong cách đường phố Bangkok hiện đại và phá cách.",
                "openTime": "10:00", "closeTime": "22:30", "phone": "02888899900",
                "featured": False, "totalSeats": 50, "availableSeats": 30, "managerID": m2.userId,
            },
            {
                "name": "Morico", "address": "30 Lê Lợi", "district": "Quận 1", "cuisine": "Nhật Bản",
                "priceRange": "Dưới 200K", "rating": 4.6, "reviewCount": 610,
                "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
                "description": "Thiên đường tráng miệng Matcha Nhật Bản và các món ăn nhẹ tinh tế.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02899900011",
                "featured": False, "totalSeats": 40, "availableSeats": 15, "managerID": m1.userId,
            },
            {
                "name": "The LOG", "address": "Tầng thượng, GEM Center", "district": "Quận 1", "cuisine": "Á - Âu",
                "priceRange": "Trên 1M", "rating": 4.7, "reviewCount": 420,
                "imageUrl": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
                "description": "Ngôi nhà gỗ trên cây sang trọng phục vụ tiệc buffet hải sản cao cấp.",
                "openTime": "18:00", "closeTime": "23:00", "phone": "02800011122",
                "featured": True, "totalSeats": 150, "availableSeats": 50, "managerID": m2.userId,
            },
            {
                "name": "Sushi Tei", "address": "200A Lý Tự Trọng", "district": "Quận 1", "cuisine": "Nhật Bản",
                "priceRange": "200K - 500K", "rating": 4.5, "reviewCount": 850,
                "imageUrl": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800",
                "description": "Chuỗi nhà hàng sushi nổi tiếng Châu Á với menu đa dạng hơn 300 món.",
                "openTime": "11:00", "closeTime": "22:30", "phone": "02812345670",
                "featured": False, "totalSeats": 100, "availableSeats": 60, "managerID": m1.userId,
            },
            {
                "name": "Crystal Jade", "address": "Tầng 5, Vạn Hạnh Mall", "district": "Quận 10", "cuisine": "Trung Quốc",
                "priceRange": "200K - 500K", "rating": 4.3, "reviewCount": 340,
                "imageUrl": "https://images.unsplash.com/photo-1563379926898-05f45c514d68?w=800",
                "description": "Nhà hàng Quảng Đông được vinh danh Michelin với các món Dimsum truyền thống.",
                "openTime": "10:30", "closeTime": "22:00", "phone": "02823456781",
                "featured": False, "totalSeats": 120, "availableSeats": 70, "managerID": m2.userId,
            },
            {
                "name": "Cơm Niêu Sài Gòn", "address": "59 Hồ Xuân Hương", "district": "Quận 3", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.2, "reviewCount": 290,
                "imageUrl": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800",
                "description": "Nổi tiếng với màn trình diễn tung cơm niêu đập lu và các món ăn đậm đà bản sắc.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02834567892",
                "featured": False, "totalSeats": 80, "availableSeats": 40, "managerID": m1.userId,
            },
            {
                "name": "Ngò Rí", "address": "16 Bùi Viện", "district": "Quận 1", "cuisine": "Thái Lan",
                "priceRange": "Dưới 200K", "rating": 4.1, "reviewCount": 450,
                "imageUrl": "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800",
                "description": "Quán ăn Thái lâu đời tại phố Tây Bùi Viện với hương vị bình dân, đậm đà.",
                "openTime": "11:00", "closeTime": "23:00", "phone": "02845678903",
                "featured": False, "totalSeats": 40, "availableSeats": 10, "managerID": m2.userId,
            },
            {
                "name": "Hoàng Yến Buffet", "address": "Tầng 3, Nguyễn Kim", "district": "Quận 5", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.4, "reviewCount": 610,
                "imageUrl": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800",
                "description": "Buffet ẩm thực Việt Nam quy tụ các món ăn từ khắp 3 miền đất nước.",
                "openTime": "11:00", "closeTime": "22:00", "phone": "02856789014",
                "featured": False, "totalSeats": 150, "availableSeats": 50, "managerID": m1.userId,
            },
            {
                "name": "Mặn Mòi", "address": "34 Võ Văn Tần", "district": "Quận 3", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.6, "reviewCount": 230,
                "imageUrl": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
                "description": "Nhà hàng với phong cách Indochine hoài cổ, phục vụ các mâm cơm Việt tinh tế.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02867890125",
                "featured": True, "totalSeats": 70, "availableSeats": 30, "managerID": m2.userId,
            },
            {
                "name": "Dì Mai", "address": "136-138 Lê Thị Hồng Gấm", "district": "Quận 1", "cuisine": "Việt Nam",
                "priceRange": "200K - 500K", "rating": 4.5, "reviewCount": 420,
                "imageUrl": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800",
                "description": "Không gian tái hiện Sài Gòn xưa với tà áo dài và chiếc xích lô mộc mạc.",
                "openTime": "07:00", "closeTime": "22:30", "phone": "02878901236",
                "featured": False, "totalSeats": 90, "availableSeats": 60, "managerID": m1.userId,
            },
            {
                "name": "Kichi Kichi", "address": "Vincom Center", "district": "Quận 1", "cuisine": "Nhật Bản",
                "priceRange": "200K - 500K", "rating": 4.3, "reviewCount": 1100,
                "imageUrl": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
                "description": "Lẩu băng chuyền Kei-Ten đa dạng món nhúng ăn thỏa thích.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02889012347",
                "featured": False, "totalSeats": 80, "availableSeats": 40, "managerID": m2.userId,
            },
            {
                "name": "King BBQ", "address": "Sư Vạn Hạnh", "district": "Quận 10", "cuisine": "Hàn Quốc",
                "priceRange": "200K - 500K", "rating": 4.4, "reviewCount": 890,
                "imageUrl": "https://images.unsplash.com/photo-1544025162-831550fe1db9?w=800",
                "description": "Vua thịt nướng Hàn Quốc với sốt ướp bí truyền từ đầu bếp Park Sung Min.",
                "openTime": "10:00", "closeTime": "22:00", "phone": "02890123458",
                "featured": False, "totalSeats": 110, "availableSeats": 60, "managerID": m1.userId,
            },
            {
                "name": "Isushi", "address": "112 Cao Thắng", "district": "Quận 3", "cuisine": "Nhật Bản",
                "priceRange": "500K - 1M", "rating": 4.5, "reviewCount": 450,
                "imageUrl": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800",
                "description": "Buffet Sashimi và các món nướng Teppanyaki Nhật Bản tươi ngon mỗi ngày.",
                "openTime": "11:00", "closeTime": "22:00", "phone": "02801234569",
                "featured": False, "totalSeats": 90, "availableSeats": 50, "managerID": m2.userId,
            }
        ]

        restaurants = []
        for r_data in restaurants_data:
            restaurant = Restaurant(**r_data)
            session.add(restaurant)
            session.commit()
            session.refresh(restaurant)
            restaurants.append(restaurant)
        print(f"  Đã tạo thành công {len(restaurants)} Restaurants!")

        print("\n=== 🧾 Đang tạo Menu Items ===")
        # Lấy 4 nhà hàng đầu tiên để tạo menu mẫu
        r1, r2, r3, r4 = restaurants[:4]

        menu_items_data = [
            # Phở Thìn
            {"restaurantId": r1.restaurantId, "name": "Phở bò tái", "description": "Phở bò tái truyền thống", "price": 65000, "category": "Phở", "image": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400"},
            {"restaurantId": r1.restaurantId, "name": "Phở bò chín", "description": "Phở bò chín mềm", "price": 65000, "category": "Phở", "image": None},
            {"restaurantId": r1.restaurantId, "name": "Trà đá", "description": "Trà đá miễn phí", "price": 0, "category": "Đồ uống", "image": None},
            # Cục Gạch Quán
            {"restaurantId": r2.restaurantId, "name": "Cơm tấm sườn", "description": "Cơm tấm sườn nướng than hoa", "price": 120000, "category": "Cơm", "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400"},
            {"restaurantId": r2.restaurantId, "name": "Bún chả Hà Nội", "description": "Bún chả với chả nướng thơm", "price": 95000, "category": "Bún", "image": None},
            # Pizza 4P's
            {"restaurantId": r3.restaurantId, "name": "Pizza Margherita", "description": "Pizza với phô mai mozzarella tự làm", "price": 189000, "category": "Pizza", "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400"},
            {"restaurantId": r3.restaurantId, "name": "Tiramisu", "description": "Tiramisu Ý truyền thống", "price": 89000, "category": "Tráng miệng", "image": None},
            # Sushi
            {"restaurantId": r4.restaurantId, "name": "Sashimi tổng hợp", "description": "Combo sashimi 12 miếng", "price": 450000, "category": "Sashimi", "image": "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400"},
        ]

        for item_data in menu_items_data:
            item = MenuItem(**item_data)
            session.add(item)
            session.commit()
            print(f"  Đã thêm món: {item.name}")

        print("\n=== 📅 Đang tạo Bookings ===")
        c1 = users["customer@tablenow.vn"]
        c2 = users["customer2@tablenow.vn"]

        bookings_data = [
            {
                "userId": c1.userId, "restaurantId": r1.restaurantId, "date": "2026-03-15", "time": "12:00",
                "guestCount": 2, "requestSeats": 2, "contactName": "Lê Minh Châu", "contactEmail": "customer@tablenow.vn",
                "contactPhone": "0900000004", "note": "Bàn gần cửa sổ nếu có", "status": "confirmed", "createdAt": datetime.now().isoformat()
            },
            {
                "userId": c2.userId, "restaurantId": r3.restaurantId, "date": "2026-03-14", "time": "18:30",
                "guestCount": 6, "requestSeats": 6, "contactName": "Phạm Đức Dũng", "contactEmail": "customer2@tablenow.vn",
                "contactPhone": "0900000005", "note": "", "status": "pending", "createdAt": datetime.now().isoformat()
            }
        ]

        for b_data in bookings_data:
            booking = Booking(**b_data)
            session.add(booking)
            session.commit()
            print(f"  Đã tạo Booking: User {booking.userId} đặt tại Restaurant {booking.restaurantId} (Status: {booking.status})")

        print("\n" + "=" * 50)
        print("✅ SEED HOÀN TẤT THÀNH CÔNG!")
        print("=" * 50)
        print("\nTài khoản test:")
        print("  Admin:    admin@tablenow.vn    / admin123")
        print("  Manager:  manager@tablenow.vn  / manager123")
        print("  Customer: customer@tablenow.vn / customer123")

if __name__ == "__main__":
    seed_database()
