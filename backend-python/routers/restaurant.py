from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Security, BackgroundTasks
from database import SessionDep
from models import Restaurant, MenuItem, User, Review, Booking
from schemas import RestaurantCreate, RestaurantUpdate, CuisineOut
from routers.authentication import get_current_user
from routers.booking import send_booking_email

from sqlalchemy import func
from sqlmodel import select

import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

router = APIRouter()

async def get_restaurant_with_stats(restaurant: Restaurant, session: SessionDep) -> dict:
    r_dict = restaurant.model_dump()
    
    # rating, reviewCount, priceRange, and promotion are already stored in the Restaurant model!
    # No need to query database for reviews and prices on read.
    
    # Booked seats is computed dynamically based on current bookings
    booked_res = await session.execute(
        select(func.sum(Booking.requestSeats)).where(
            Booking.restaurantId == restaurant.restaurantId,
            Booking.status.in_(['pending', 'confirmed'])
        )
    )
    booked_seats = booked_res.scalar() or 0
    r_dict['availableSeats'] = max(0, restaurant.totalSeats - booked_seats)
        
    return r_dict

@router.post("/api/create-restaurant/", tags=["Restaurant"])
async def create_restaurant(restaurant_data: RestaurantCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = Restaurant(**restaurant_data.model_dump())
    session.add(restaurant)
    await session.commit()
    await session.refresh(restaurant)
    return await get_restaurant_with_stats(restaurant, session)

@router.get("/api/get-all-restaurant/", tags=["Restaurant"])
async def get_all_restaurants(session: SessionDep):
    # 1. Query all active restaurants directly without joins
    res = await session.execute(
        select(Restaurant).where(Restaurant.status == "active")
    )
    restaurants = res.scalars().all()

    # 2. Bulk query booked seats for active bookings
    booked_res = await session.execute(
        select(
            Booking.restaurantId,
            func.sum(Booking.requestSeats)
        ).filter(Booking.status.in_(['pending', 'confirmed'])).group_by(Booking.restaurantId)
    )
    booked_map = {row[0]: row[1] or 0 for row in booked_res.all()}
    
    response = []
    for r in restaurants:
        r_dict = r.model_dump()
        
        # availableSeats is computed dynamically based on current bookings
        booked_seats = booked_map.get(r.restaurantId, 0)
        r_dict['availableSeats'] = max(0, r.totalSeats - booked_seats)
            
        response.append(r_dict)
    return response

@router.get("/api/get-restaurant/{restaurant_id}", tags=["Restaurant"])
async def get_restaurant_by_id(restaurant_id: int, session: SessionDep):
    res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Join menu items
    menu_res = await session.execute(select(MenuItem).where(MenuItem.restaurantId == restaurant_id))
    menu_items = menu_res.scalars().all()
    
    result = await get_restaurant_with_stats(restaurant, session)
    result["menu"] = [item.model_dump() for item in menu_items]
    return result

@router.delete("/api/delete-restaurant/{restaurant_id}", tags=["Restaurant"])
async def delete_restaurant_by_id(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = res.scalars().first()
    if restaurant:
        await session.delete(restaurant)
        await session.commit()
        return {"message": "Restaurant deleted successfully"}
    return {"message": "Restaurant not found"}

@router.put("/api/update-restaurant/{restaurant_id}", tags=["Restaurant"])
async def update_restaurant_by_id(restaurant_id: int, updated_restaurant: RestaurantUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = res.scalars().first()
    if restaurant:
        update_data = updated_restaurant.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(restaurant, field, value)
        await session.commit()
        await session.refresh(restaurant)
        return await get_restaurant_with_stats(restaurant, session)
    return {"message": "Restaurant not found"}

@router.get("/api/admin/pending-restaurants/", tags=["Admin"])
async def get_pending_restaurants(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    res = await session.execute(select(Restaurant).where(Restaurant.status == "pending"))
    restaurants = res.scalars().all()
    return [r.model_dump() for r in restaurants]

@router.patch("/api/admin/approve-restaurant/{restaurant_id}", tags=["Admin"])
async def approve_restaurant(restaurant_id: int, background_tasks: BackgroundTasks, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant.status = "active"
    await session.commit()

    # Gửi email thông báo phê duyệt
    manager_res = await session.execute(select(User).where(User.userId == restaurant.managerID))
    manager = manager_res.scalars().first()
    if manager and manager.email:
        email_subject = f"🎉 [TableNow] Chúc mừng! Đối tác nhà hàng '{restaurant.name}' đã được phê duyệt thành công"
        email_content = (
            f"Xin chào {manager.name},\n\n"
            f"Chúng tôi vô cùng vui mừng thông báo rằng yêu cầu đăng ký hợp tác kinh doanh của nhà hàng "
            f"'{restaurant.name}' đã được đội ngũ Ban quản trị TableNow phê duyệt thành công!\n\n"
            f"Tài khoản quản lý của bạn đã được kích hoạt hoạt động. Hiện tại bạn có thể đăng nhập vào hệ thống để quản lý thực đơn, "
            f"bàn trống, theo dõi các yêu cầu đặt bàn và cập nhật thông tin nhà hàng.\n\n"
            f"--------------------------------------------------\n"
            f"📌 THÔNG TIN ĐỐI TÁC & NHÀ HÀNG:\n"
            f"--------------------------------------------------\n"
            f"• Tên nhà hàng: {restaurant.name}\n"
            f"• Địa chỉ: {restaurant.address}, {restaurant.district}\n"
            f"• Số điện thoại nhà hàng: {restaurant.phone}\n"
            f"• Giờ mở cửa: {restaurant.openTime} - {restaurant.closeTime}\n"
            f"• Sức chứa: {restaurant.totalSeats} chỗ ngồi\n\n"
            f"--------------------------------------------------\n"
            f"🔑 THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP:\n"
            f"--------------------------------------------------\n"
            f"• Tài khoản đăng nhập (Email): {manager.email}\n"
            f"• Mật khẩu: [Mật khẩu bạn đã tạo khi đăng ký đối tác]\n"
            f"• Đường dẫn đăng nhập quản lý: {FRONTEND_URL}/login\n\n"
            f"--------------------------------------------------\n"
            f"💼 CHÍNH SÁCH PHÍ DỊCH VỤ:\n"
            f"--------------------------------------------------\n"
            f"• Phí dịch vụ: 6.000đ cho mỗi đơn đặt bàn thành công.\n"
            f"• Đơn đặt bàn được tính phí khi và chỉ khi nhà hàng xác nhận hoàn thành (Completed).\n"
            f"• Bạn có thể theo dõi và thực hiện thanh toán phí đặt bàn thông qua mục 'Thanh toán phí' trong trang quản lý nhà hàng.\n\n"
            f"--------------------------------------------------\n"
            f"📞 LIÊN HỆ HỖ TRỢ ĐỐI TÁC:\n"
            f"--------------------------------------------------\n"
            f"Nếu bạn cần thêm thông tin hoặc cần hỗ trợ kỹ thuật, xin vui lòng liên hệ với chúng tôi qua:\n"
            f"• Hotline hỗ trợ đối tác: 1900 6868\n"
            f"• Email hỗ trợ: partner@tablenow.vn\n"
            f"• Thời gian hỗ trợ: 08:00 - 22:00 hàng ngày\n\n"
            f"Chào mừng bạn gia nhập đại gia đình đối tác TableNow! Chúc nhà hàng kinh doanh hồng phát và luôn đông khách!\n\n"
            f"Trân trọng,\n"
            f"Ban Quản Trị Hệ Thống TableNow"
          )
        background_tasks.add_task(send_booking_email, manager.email, email_subject, email_content)
        
    return {"message": "Restaurant approved successfully"}

@router.patch("/api/admin/reject-restaurant/{restaurant_id}", tags=["Admin"])
async def reject_restaurant(restaurant_id: int, background_tasks: BackgroundTasks, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant.status = "rejected"
    await session.commit()

    # Gửi email thông báo từ chối
    manager_res = await session.execute(select(User).where(User.userId == restaurant.managerID))
    manager = manager_res.scalars().first()
    if manager and manager.email:
        email_subject = f"❌ [TableNow] Thông báo kết quả phê duyệt hồ sơ đối tác '{restaurant.name}'"
        email_content = (
            f"Xin chào {manager.name},\n\n"
            f"Cảm ơn bạn đã quan tâm và gửi yêu cầu đăng ký đối tác kinh doanh với hệ thống TableNow cho nhà hàng "
            f"'{restaurant.name}'.\n\n"
            f"Sau khi xem xét kỹ lưỡng hồ sơ đăng ký (bao gồm thông tin giấy phép kinh doanh, mã số thuế và hình ảnh), "
            f"chúng tôi rất tiếc phải thông báo rằng yêu cầu đăng ký của nhà hàng '{restaurant.name}' hiện tại "
            f"CHƯA ĐƯỢC PHÊ DUYỆT do một số thông tin chưa đạt yêu cầu kiểm duyệt của hệ thống.\n\n"
            f"Để hoàn tất thủ tục và phê duyệt lại, vui lòng kiểm tra lại tính chính xác của các tài liệu đăng ký "
            f"hoặc liên hệ trực tiếp với bộ phận chăm sóc đối tác của chúng tôi để được hướng dẫn chi tiết.\n\n"
            f"--------------------------------------------------\n"
            f"📞 THÔNG TIN LIÊN HỆ HỖ TRỢ:\n"
            f"--------------------------------------------------\n"
            f"• Hotline hỗ trợ đối tác: 1900 6868\n"
            f"• Email hỗ trợ: partner@tablenow.vn\n"
            f"• Thời gian hỗ trợ: 08:00 - 22:00 hàng ngày\n\n"
            f"Chúng tôi rất hy vọng sẽ được sớm đồng hành cùng bạn trong tương lai.\n\n"
            f"Trân trọng,\n"
            f"Ban Quản Trị Hệ Thống TableNow"
        )
        background_tasks.add_task(send_booking_email, manager.email, email_subject, email_content)
        
    return {"message": "Restaurant rejected"}

CUISINES_DATA = [
    {"id": "all", "label": "Tất cả", "icon": "🍽️"},
    {"id": "seafood", "label": "Hải sản", "icon": "🦐"},
    {"id": "european", "label": "Đồ Âu", "icon": "🥩"},
    {"id": "buffet", "label": "Buffet", "icon": "🍱"},
    {"id": "japanese", "label": "Nhật Bản", "icon": "🍣"},
    {"id": "korean", "label": "Hàn Quốc", "icon": "🥘"},
    {"id": "vietnamese", "label": "Việt Nam", "icon": "🍜"},
    {"id": "hotpot", "label": "Lẩu", "icon": "♨️"},
    {"id": "bbq", "label": "Nướng", "icon": "🔥"},
    {"id": "chinese", "label": "Trung Hoa", "icon": "🥟"},
    {"id": "thai", "label": "Thái Lan", "icon": "🌶️"},
    {"id": "vegetarian", "label": "Món Chay", "icon": "🥗"},
    {"id": "fastfood", "label": "Thức ăn nhanh", "icon": "🍔"},
    {"id": "cafe", "label": "Café & Trà", "icon": "☕"},
    {"id": "finedining", "label": "Sang trọng", "icon": "✨"}
]

@router.get("/api/cuisines/", response_model=list[CuisineOut], tags=["Cuisine"])
def get_cuisines():
    return CUISINES_DATA
