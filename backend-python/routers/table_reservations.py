from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Security, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlmodel import select
from database import SessionDep
from models.user import User
from models.notification import Notification
from routers.deps import get_current_user
from routers.restaurant_tables import managed_restaurant
from core.table_reservations import sync_table_reservations
from core.booking_capacity import APP_TIME_ZONE

router = APIRouter(prefix="/v1/table-reservations", tags=["Table reservations"])
Manager = Annotated[User, Security(get_current_user, scopes=["manager"])]
Admin = Annotated[User, Security(get_current_user, scopes=["admin"])]

ISSUES = '''SELECT i.*, r.name AS restaurant_name, t.name AS table_name,
 b."contactName" AS customer, b.date, b.time, b."requestSeats" AS seats
 FROM table_booking_incidents i JOIN restaurants r ON r.id=i.restaurant_id
 JOIN booking b ON b."bookingId"=i.booking_id LEFT JOIN restaurant_tables t ON t.id=i.table_id'''


@router.get("/me")
def mine(session: SessionDep, user: Manager):
    restaurant = managed_restaurant(session, user)
    holds = sync_table_reservations(session, restaurant)
    issues = [dict(row) for row in session.execute(text(ISSUES + " WHERE i.restaurant_id=:rid ORDER BY i.created_at DESC LIMIT 100"), {"rid":restaurant.id}).mappings().all()]
    session.commit()
    return {"reservations":holds,"incidents":issues}


class Solution(BaseModel):
    solution: str = Field(min_length=10, max_length=5000)


@router.post("/{incident_id}/solution")
def submit(incident_id: int, data: Solution, session: SessionDep, user: Manager):
    restaurant = managed_restaurant(session, user)
    solution = data.solution.strip()
    if len(solution)<10:
        raise HTTPException(422,"Mô tả phương án cần ít nhất 10 ký tự.")
    row = session.execute(text("UPDATE table_booking_incidents SET solution=:solution,submitted_by=:uid,submitted_at=CURRENT_TIMESTAMP,reviewed_at=NULL,reviewed_by=NULL,admin_note=NULL WHERE id=:id AND restaurant_id=:rid RETURNING booking_id"), {"solution":solution,"uid":user.userId,"id":incident_id,"rid":restaurant.id}).first()
    if not row:
        raise HTTPException(404,"Không tìm thấy xung đột bàn của nhà hàng.")
    from models.violationReport import ViolationReport
    report = session.exec(select(ViolationReport).where(ViolationReport.booking_id == row.booking_id, ViolationReport.target_restaurant_id == restaurant.id, ViolationReport.source == "table_full", ViolationReport.status.in_(["open", "confirmed", "appeal_pending"])).with_for_update()).first()
    if report:
        report.appeal_reason = solution
        report.status = "appeal_pending"
        session.add(report)
    admins = session.exec(select(User).where(User.role == "admin")).all()
    for admin in admins:
        session.add(Notification(userId=admin.userId,bookingId=row.booking_id,title="Phương án xử lý xung đột bàn",message=f"{restaurant.name} gửi phương án cho đơn #{row.booking_id}. Xem mục Xung đột bàn trong quản trị.",type="table_conflict",createdAt=datetime.now(APP_TIME_ZONE).isoformat()))
    session.commit()
    return {"ok":True}


@router.get("/admin")
def admin_list(session: SessionDep, user: Admin, offset: int = 0):
    offset = max(0,offset)
    return [dict(row) for row in session.execute(text(ISSUES + " ORDER BY i.created_at DESC LIMIT 21 OFFSET :offset"),{"offset":offset}).mappings().all()]


class Review(BaseModel):
    note: str = Field(min_length=3,max_length=5000)


@router.post("/admin/{incident_id}/review")
def review(incident_id:int, data:Review, session:SessionDep, user:Admin):
    if len(data.note.strip()) < 3:
        raise HTTPException(422, "Phản hồi cần ít nhất 3 ký tự.")
    row=session.execute(text("UPDATE table_booking_incidents SET admin_note=:note,reviewed_by=:uid,reviewed_at=CURRENT_TIMESTAMP WHERE id=:id AND solution IS NOT NULL RETURNING restaurant_id,booking_id"),{"note":data.note.strip(),"uid":user.userId,"id":incident_id}).first()
    if not row:
        raise HTTPException(404,"Chưa có phương án để xem xét.")
    from models.restaurant import Restaurant
    restaurant=session.get(Restaurant,row.restaurant_id)
    session.add(Notification(userId=restaurant.manager_id,bookingId=row.booking_id,title="Admin phản hồi phương án xung đột bàn",message=data.note.strip(),type="table_conflict",createdAt=datetime.now(APP_TIME_ZONE).isoformat()))
    session.commit()
    return {"ok":True}
