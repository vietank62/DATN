from datetime import datetime, timezone
import re
from typing import Annotated, Any
import unicodedata
from fastapi import APIRouter, HTTPException, Query, Security
from sqlmodel import select # type: ignore
from sqlalchemy import func  # type: ignore

from database import SessionDep, redis_client
from models.approvalHistory import ApprovalHistory
from models.notification import Notification
from models.restaurant import Restaurant
from models.resDetail import RestaurantDetail
from models.user import User
from routers.deps import get_current_user
from schemas.partner import (
    PartnerApplicationCreate,
    PartnerOperationalUpdate,
    PartnerRejectRequest,
)

router = APIRouter(prefix="/v1/partners", tags=["Partner"])
CACHE_KEY_SET = "cache:restaurants:keys"
NEW_APPLICATION_FIELD = "__new__"

APPROVAL_FIELD_LABELS = {
    "name": "Thay đổi tên nhà hàng",
    "address": "Thay đổi địa chỉ",
    "district": "Thay đổi quận / huyện",
    "city": "Thay đổi thành phố",
    "website_url": "Thay đổi website chính thức",
    "category": "Thay đổi danh mục nhà hàng",
    "tax_code": "Thay đổi mã số thuế",
    "image_url": "Thay đổi ảnh đại diện",
    "image_urls": "Thay đổi hình ảnh nhà hàng",
    "business_license_url": "Thay đổi ảnh giấy phép kinh doanh",
    "business_license_urls": "Thay đổi ảnh giấy phép kinh doanh",
    "legal_documents_urls": "Thay đổi tài liệu pháp lý",
}

RESTAURANT_APPROVAL_FIELDS = (
    "name",
    "address",
    "district",
    "city",
    "website_url",
    "category",
    "tax_code",
    "business_license_url",
    "business_license_urls",
    "legal_documents_urls",
    "image_url",
)


async def clear_restaurant_caches() -> None:
    try:
        keys = await redis_client.smembers(CACHE_KEY_SET)
        if keys:
            await redis_client.delete(*keys)
        await redis_client.delete(CACHE_KEY_SET)
    except Exception as error:
        print(f"Redis Clear Cache Error: {error}")


def get_pending_approval_request(restaurant: Restaurant) -> tuple[str, list[str]]:
    pending_fields = restaurant.pending_approval_fields or []
    is_new_application = (
        NEW_APPLICATION_FIELD in pending_fields
        or not pending_fields
    )

    if is_new_application:
        return "new", ["Thêm mới"]

    return (
        "update",
        [
            APPROVAL_FIELD_LABELS[field]
            for field in pending_fields
            if field in APPROVAL_FIELD_LABELS
        ],
    )


def create_approval_history(
    session: SessionDep,
    restaurant: Restaurant,
    admin_id: int | None,
    action: str,
    request_type: str,
    change_fields: list[str],
    rejection_reason: str | None = None,
    deactivate_restaurant: bool | None = None,
) -> None:
    if not restaurant.id or not restaurant.manager_id:
        return

    session.add(
        ApprovalHistory(
            restaurant_id=restaurant.id,
            manager_id=restaurant.manager_id,
            admin_id=admin_id,
            action=action,
            request_type=request_type,
            change_fields=change_fields,
            rejection_reason=rejection_reason,
            deactivate_restaurant=deactivate_restaurant,
        )
    )


def create_manager_notification(
    session: SessionDep,
    restaurant: Restaurant,
    title: str,
    message: str,
    notification_type: str,
) -> None:
    if not restaurant.manager_id:
        return

    session.add(
        Notification(
            userId=restaurant.manager_id,
            title=title,
            message=message,
            type=notification_type,
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
    )


def create_available_slug(session: SessionDep, name: str) -> str:
    normalized = unicodedata.normalize("NFD", name.strip().lower())
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    base_slug = re.sub(r"[^a-z0-9]+", "-", normalized.replace("\u0111", "d")).strip("-")
    base_slug = base_slug or "restaurant"

    slug = base_slug
    suffix = 2

    while session.exec(select(Restaurant.id).where(Restaurant.slug == slug)).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    return slug


@router.post("/application", response_model=Restaurant)
def submit_application(data: PartnerApplicationCreate, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    if not data.policy_accepted:
        raise HTTPException(400, "You must accept TableNow partner policy")
    if not data.business_license_urls and not data.business_license_url:
        raise HTTPException(400, "At least one business license image is required")
    if session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first():
        raise HTTPException(409, "This manager already has a restaurant application")
    payload = data.model_dump(
        exclude={
            "policy_accepted",
            "image_urls",
            "business_license_urls",
            "legal_documents_urls",
        },
    )
    payload["slug"] = create_available_slug(session, data.name)
    if data.business_license_urls:
        payload["business_license_urls"] = data.business_license_urls
        payload["business_license_url"] = data.business_license_urls[0]
    if data.legal_documents_urls:
        payload["legal_documents_urls"] = data.legal_documents_urls
        payload["legal_documents_url"] = data.legal_documents_urls[0]
    restaurant = Restaurant(
        **payload,
        manager_id=current_user.userId,
        is_active=False,
        approval_status="pending",
        pending_approval_fields=[NEW_APPLICATION_FIELD],
        policy_accepted_at=datetime.now(timezone.utc),
    )
    session.add(restaurant); session.commit(); session.refresh(restaurant)
    if data.image_urls:
        detail = RestaurantDetail(
            restaurant_id=restaurant.id,
            image_urls=data.image_urls,
        )
        session.add(detail); session.commit()
    return restaurant


@router.get("/application/me", response_model=Restaurant | None)
def my_application(current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    return session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first()


@router.put("/application/me/operational", response_model=Restaurant)
async def update_operational(data: PartnerOperationalUpdate, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first()
    if not restaurant:
        raise HTTPException(404, "Restaurant application not found")

    changed_approval_fields: set[str] = set()

    for key in RESTAURANT_APPROVAL_FIELDS:
        if key not in data.model_fields_set:
            continue

        value = getattr(data, key)

        if getattr(restaurant, key) != value:
            changed_approval_fields.add(key)
            setattr(restaurant, key, value)

    for key in (
        "capacity",
        "price_avg",
        "booking_opening_time",
        "booking_closing_time",
    ):
        if key in data.model_fields_set:
            setattr(restaurant, key, getattr(data, key))

    detail = session.exec(select(RestaurantDetail).where(RestaurantDetail.restaurant_id == restaurant.id)).first()
    if not detail:
        detail = RestaurantDetail(restaurant_id=restaurant.id)

    if data.description is not None:
        detail.description = data.description
    if data.price_range is not None:
        detail.price_range = data.price_range
    if data.opening_time is not None:
        detail.opening_time = data.opening_time
    if data.image_urls is not None:
        if detail.image_urls != data.image_urls:
            changed_approval_fields.add("image_urls")
        detail.image_urls = data.image_urls
    if data.parking_info is not None:
        detail.parking_info = data.parking_info
    if data.utilities is not None:
        detail.utilities = data.utilities
    if data.regulations is not None:
        detail.regulations = data.regulations

    if changed_approval_fields:
        pending_fields = set(restaurant.pending_approval_fields or [])

        if NEW_APPLICATION_FIELD not in pending_fields:
            pending_fields.update(changed_approval_fields)
            restaurant.pending_approval_fields = sorted(pending_fields)

        restaurant.approval_status = "pending"
        restaurant.is_active = False

    session.add(restaurant)
    session.add(detail)
    session.commit()
    session.refresh(restaurant)
    try:
        await redis_client.delete(f"cache:details:{restaurant.id}")
    except Exception as error:
        print(f"Redis Clear Detail Cache Error: {error}")
    return restaurant


@router.get("/applications", response_model=list[dict])
def pending_applications(current_user: Annotated[User, Security(get_current_user, scopes=["admin"])], session: SessionDep):
    applications = session.exec(
        select(Restaurant)
        .where(Restaurant.approval_status == "pending")
        .order_by(Restaurant.created_at.desc())
    ).all()
    restaurant_ids = [restaurant.id for restaurant in applications if restaurant.id]
    details = session.exec(
        select(RestaurantDetail).where(RestaurantDetail.restaurant_id.in_(restaurant_ids))
    ).all() if restaurant_ids else []
    detail_by_restaurant_id = {
        detail.restaurant_id: detail
        for detail in details
    }
    manager_ids = [restaurant.manager_id for restaurant in applications if restaurant.manager_id]
    managers = session.exec(
        select(User).where(User.userId.in_(manager_ids))
    ).all() if manager_ids else []
    manager_by_id = {
        manager.userId: manager
        for manager in managers
    }
    result = []
    for restaurant in applications:
        application = restaurant.model_dump()
        detail = detail_by_restaurant_id.get(restaurant.id)
        manager = manager_by_id.get(restaurant.manager_id)
        application["image_urls"] = detail.image_urls if detail else []
        request_type, change_fields = get_pending_approval_request(restaurant)
        application["approval_request_type"] = request_type
        application["approval_change_fields"] = change_fields
        application["manager"] = (
            {
                "name": manager.name,
                "email": manager.email,
                "phone": manager.phone,
            }
            if manager
            else None
        )
        result.append(application)
    return result


@router.delete("/application/me/pending-approval", response_model=Restaurant)
async def cancel_pending_approval(
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
    session: SessionDep,
):
    restaurant = session.exec(
        select(Restaurant).where(Restaurant.manager_id == current_user.userId)
    ).first()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant application not found")

    request_type, change_fields = get_pending_approval_request(restaurant)

    if restaurant.approval_status != "pending" or request_type != "update":
        raise HTTPException(
            status_code=400,
            detail="Chỉ có thể hủy yêu cầu chỉnh sửa đang chờ xét duyệt",
        )

    restaurant.pending_approval_fields = None
    restaurant.approval_status = "approved"
    restaurant.is_active = True

    create_approval_history(
        session=session,
        restaurant=restaurant,
        admin_id=None,
        action="cancelled",
        request_type=request_type,
        change_fields=change_fields,
    )
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    await clear_restaurant_caches()
    return restaurant


@router.put("/applications/{restaurant_id}/approve", response_model=Restaurant)
async def approve_application(restaurant_id: int, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])], session: SessionDep):
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(404, "Application not found")

    request_type, change_fields = get_pending_approval_request(restaurant)
    restaurant.approval_status = "approved"
    restaurant.is_active = True
    restaurant.pending_approval_fields = None
    create_approval_history(
        session=session,
        restaurant=restaurant,
        admin_id=current_user.userId,
        action="approved",
        request_type=request_type,
        change_fields=change_fields,
    )
    create_manager_notification(
        session=session,
        restaurant=restaurant,
        title="Hồ sơ nhà hàng đã được duyệt",
        message=(
            "Nhà hàng của bạn đã được duyệt và đang hoạt động trên TableNow."
            if request_type == "new"
            else "Yêu cầu chỉnh sửa hồ sơ nhà hàng của bạn đã được duyệt."
        ),
        notification_type="approval_approved",
    )
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    await clear_restaurant_caches()
    return restaurant


@router.put("/applications/{restaurant_id}/reject", response_model=Restaurant)
async def reject_application(
    restaurant_id: int,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
    session: SessionDep,
    data: PartnerRejectRequest,
):
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(404, "Application not found")

    request_type, change_fields = get_pending_approval_request(restaurant)
    is_new_application = request_type == "new"
    deactivate_restaurant = True if is_new_application else data.deactivate

    restaurant.approval_status = "rejected"
    restaurant.is_active = not deactivate_restaurant
    create_approval_history(
        session=session,
        restaurant=restaurant,
        admin_id=current_user.userId,
        action="rejected",
        request_type=request_type,
        change_fields=change_fields,
        rejection_reason=data.rejection_reason.strip(),
        deactivate_restaurant=deactivate_restaurant,
    )
    create_manager_notification(
        session=session,
        restaurant=restaurant,
        title="Hồ sơ nhà hàng cần được chỉnh sửa",
        message=f"Lý do từ chối: {data.rejection_reason.strip()}",
        notification_type="approval_rejected",
    )

    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    await clear_restaurant_caches()
    return restaurant


def serialize_approval_history(
    row: ApprovalHistory,
    restaurant: Restaurant | None,
    admin: User | None,
) -> dict:
    return {
        "id": row.id,
        "restaurant_id": row.restaurant_id,
        "restaurant_name": restaurant.name if restaurant else "Nhà hàng không xác định",
        "action": row.action,
        "request_type": row.request_type,
        "change_fields": row.change_fields or [],
        "rejection_reason": row.rejection_reason,
        "deactivate_restaurant": row.deactivate_restaurant,
        "created_at": row.created_at,
        "admin_name": admin.name if admin else "Quản trị viên",
    }


@router.get("/approval-history", response_model=dict)
def get_approval_history(
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
):
    total = session.exec(select(func.count(ApprovalHistory.id))).one()
    rows = session.exec(
        select(ApprovalHistory)
        .order_by(ApprovalHistory.created_at.desc(), ApprovalHistory.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    restaurant_ids = [row.restaurant_id for row in rows]
    admin_ids = [row.admin_id for row in rows if row.admin_id]
    restaurants = session.exec(
        select(Restaurant).where(Restaurant.id.in_(restaurant_ids))
    ).all() if restaurant_ids else []
    admins = session.exec(
        select(User).where(User.userId.in_(admin_ids))
    ).all() if admin_ids else []
    restaurants_by_id = {restaurant.id: restaurant for restaurant in restaurants}
    admins_by_id = {admin.userId: admin for admin in admins}

    return {
        "items": [
            serialize_approval_history(
                row,
                restaurants_by_id.get(row.restaurant_id),
                admins_by_id.get(row.admin_id),
            )
            for row in rows
        ],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/approval-history/me", response_model=list[dict])
def get_my_approval_history(
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
    session: SessionDep,
):
    rows = session.exec(
        select(ApprovalHistory)
        .where(ApprovalHistory.manager_id == current_user.userId)
        .order_by(ApprovalHistory.created_at.desc(), ApprovalHistory.id.desc())
        .limit(30)
    ).all()
    restaurant_ids = [row.restaurant_id for row in rows]
    admin_ids = [row.admin_id for row in rows if row.admin_id]
    restaurants = session.exec(
        select(Restaurant).where(Restaurant.id.in_(restaurant_ids))
    ).all() if restaurant_ids else []
    admins = session.exec(
        select(User).where(User.userId.in_(admin_ids))
    ).all() if admin_ids else []
    restaurants_by_id = {restaurant.id: restaurant for restaurant in restaurants}
    admins_by_id = {admin.userId: admin for admin in admins}

    return [
        serialize_approval_history(
            row,
            restaurants_by_id.get(row.restaurant_id),
            admins_by_id.get(row.admin_id),
        )
        for row in rows
    ]
