"""Due confirmed bookings hold their real assigned tables until attendance is handled."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from sqlmodel import select
from fastapi import HTTPException
from models.booking import Booking
from models.restaurant import Restaurant
from models.restaurantTable import BookingTable, RestaurantTable
from models.notification import Notification
from models.bookingItem import BookingItem
from models.menuItem import RestaurantMenuList
from core.booking_capacity import APP_TIME_ZONE, booking_window


def record_full_table_violation(session, restaurant, booking_id):
    from models.violationReport import ViolationReport
    existing = session.exec(select(ViolationReport).where(ViolationReport.booking_id == booking_id, ViolationReport.target_restaurant_id == restaurant.id, ViolationReport.source == "table_full")).first()
    if existing:
        return existing
    report = ViolationReport(booking_id=booking_id, reporter_id=restaurant.manager_id,
        target_restaurant_id=restaurant.id, target_type="restaurant", source="table_full",
        restaurant_active_before_report=restaurant.is_active,
        restaurant_suspended_before_report=restaurant.is_report_suspended,
        reason="Khách có đơn đã xác nhận đến giờ dùng bữa nhưng tất cả bàn đang có bill. Nhà hàng cần gửi phương án xử lý và giải trình trong 24 giờ; quá hạn chưa giải trình sẽ bị dừng hoạt động.")
    session.add(report)
    session.add(Notification(userId=restaurant.manager_id, bookingId=booking_id, title="Vi phạm không có bàn tiếp nhận khách",
        message=report.reason, type="table_conflict", createdAt=datetime.now(APP_TIME_ZONE).isoformat()))
    from models.user import User
    for admin in session.exec(select(User).where(User.role == "admin")).all():
        session.add(Notification(userId=admin.userId, bookingId=booking_id, title="Nhà hàng hết bàn khi khách tới", message=f"{restaurant.name} · Đơn #{booking_id}. Nhà hàng có 24 giờ để gửi giải trình.", type="table_conflict", createdAt=datetime.now(APP_TIME_ZONE).isoformat()))
    session.flush()
    return report


def suspend_unexplained_table_violations(session, now=None):
    from models.violationReport import ViolationReport
    now = now or datetime.now(timezone.utc)
    reports = session.exec(select(ViolationReport).where(ViolationReport.source == "table_full", ViolationReport.status == "open", ViolationReport.appeal_reason == None, ViolationReport.created_at <= now - timedelta(hours=24))).all()
    for report in reports:
        restaurant = session.exec(select(Restaurant).where(Restaurant.id == report.target_restaurant_id).with_for_update()).first()
        if not restaurant:
            continue
        report = session.exec(select(ViolationReport).where(ViolationReport.id == report.id).with_for_update().execution_options(populate_existing=True)).first()
        if not report or report.status != "open" or report.appeal_reason:
            continue
        restaurant.is_active = False
        restaurant.is_report_suspended = True
        report.status = "confirmed"
        report.admin_note = "Tự động dừng hoạt động vì chưa gửi giải trình lỗi hết bàn trong 24 giờ."
        session.add(restaurant)
        session.add(report)
        session.add(Notification(userId=restaurant.manager_id, bookingId=report.booking_id, title="Nhà hàng bị dừng hoạt động", message=report.admin_note, type="table_conflict", createdAt=now.isoformat()))


def due_reservations(session, restaurant_id, now=None):
    now = now or datetime.now(APP_TIME_ZONE)
    rows = session.exec(select(Booking, BookingTable, RestaurantTable)
        .join(BookingTable, BookingTable.booking_id == Booking.bookingId)
        .join(RestaurantTable, RestaurantTable.id == BookingTable.table_id)
        .where(Booking.restaurantId == restaurant_id, Booking.status == "confirmed",
               Booking.date <= now.date().isoformat()).order_by(Booking.date, Booking.time, Booking.bookingId)).all()
    result = []
    for booking, assignment, table in rows:
        try:
            start, _ = booking_window(booking.date, booking.time, 120)
        except (ValueError, TypeError):
            continue
        if start <= now:
            result.append({"booking_id": booking.bookingId, "table_id": table.id,
                "table_name": table.name, "customer": booking.contactName,
                "seats": booking.requestSeats, "meal_at": start.isoformat(), "attendance": booking.attendance})
    return result


def reservation_conflicts(reservations, orders):
    holders = {}
    for reservation in reservations:
        key = str(reservation["table_id"])
        order = orders.get(key, {})
        occupied = bool(order.get("lines") or order.get("kitchenLines"))
        reservation["conflict"] = (occupied and order.get("bookingId") != reservation["booking_id"]) or key in holders
        holders.setdefault(key, reservation["booking_id"])
    return reservations


def validate_reserved_orders(reservations, previous, orders):
    holds = {}
    for reservation in reservations:
        holds.setdefault(str(reservation["table_id"]), set()).add(reservation["booking_id"])
    for key, order in orders.items():
        old = previous.get(key, {})
        if key not in holds or not order.get("lines"):
            continue
        # An existing bill may still be edited/paid/moved away; never overwrite it with the arriving party.
        if old.get("lines") or old.get("kitchenLines"):
            if order.get("bookingId") != old.get("bookingId"):
                raise HTTPException(409, "Bàn đang có bill. Không được ghi đè bill bằng đơn đặt bàn mới.")
        elif len(holds[key]) != 1 or order.get("bookingId") not in holds[key]:
            raise HTTPException(409, "Bàn đã giữ cho đơn đặt bàn tới giờ. Hãy tiếp nhận đúng khách hoặc xử lý xung đột.")


def sync_table_reservations(session, restaurant):
    # The caller locks the restaurant before checking its workspace.
    row = session.execute(text("SELECT data FROM cashier_workspaces WHERE restaurant_id=:id FOR UPDATE"), {"id":restaurant.id}).first()
    # Import preorders once, pending kitchen confirmation; never replace bills.
    import copy
    import json
    workspace = copy.deepcopy(row.data) if row else {"orders": {}, "shifts": []}
    from core.cashier_booking_completion import complete_paid_bookings
    repaired = complete_paid_bookings(session, restaurant.id, workspace, workspace, reconcile=True)
    if repaired:
        session.flush()
    orders = workspace.get("orders", {})
    from core.booking_hold_expiry import release_expired_holds
    released = release_expired_holds(session, restaurant, workspace)
    reservations = reservation_conflicts(due_reservations(session, restaurant.id), orders)
    changed = bool(repaired or released)
    imported = {order.get("bookingId") for order in workspace.get("orders", {}).values() if order.get("preordersImported")}
    imported.update(bill.get("bookingId") for shift in workspace.get("shifts", []) for bill in shift.get("bills", []) if bill.get("preordersImported"))
    primary_tables = {}
    for item in reservations:
        primary_tables[item["booking_id"]] = min(primary_tables.get(item["booking_id"], item["table_id"]), item["table_id"])
    for item in reservations:
        key = str(item["table_id"])
        old = workspace.setdefault("orders", {}).get(key, {})
        if item["conflict"]:
            continue
        same_booking = old.get("bookingId") == item["booking_id"]
        if not same_booking and (old.get("lines") or old.get("kitchenLines")):
            continue
        if not same_booking:
            workspace["orders"][key] = {"bookingId": item["booking_id"], "openedAt": item["meal_at"], "lines": [], "note": f"Đặt bàn online #{item['booking_id']} · {item['customer']}", "discount": 0, "guests": item["seats"], "vat": 8 if restaurant.vat_enabled else 0}
            changed = True
        order = workspace["orders"][key]
        if item["booking_id"] not in imported and item["table_id"] == primary_tables[item["booking_id"]]:
            if not order.get("lines") and not order.get("kitchenLines"):
                rows = session.exec(select(BookingItem, RestaurantMenuList).join(RestaurantMenuList, RestaurantMenuList.id == BookingItem.itemId).where(BookingItem.bookingId == item["booking_id"], RestaurantMenuList.restaurant_id == restaurant.id)).all()
                order["lines"] = [{"id": menu.id, "name": menu.name, "category": menu.category, "price": booked.price, "quantity": booked.quantity, "image_url": menu.image_url, "is_available": menu.is_available} for booked, menu in rows]
            order["preordersImported"] = True
            imported.add(item["booking_id"])
            changed = True
    if changed:
        session.execute(text("""INSERT INTO cashier_workspaces (restaurant_id,version,data)
            VALUES (:rid,1,CAST(:data AS jsonb)) ON CONFLICT (restaurant_id)
            DO UPDATE SET data=EXCLUDED.data,version=cashier_workspaces.version+1"""), {"rid": restaurant.id, "data": json.dumps(workspace, ensure_ascii=False)})
    active = set()
    for item in reservations:
        if not item["conflict"]:
            continue
        tables = session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).all()
        if tables and all((orders.get(str(table.id), {}).get("lines") or orders.get(str(table.id), {}).get("kitchenLines")) and orders.get(str(table.id), {}).get("bookingId") != item["booking_id"] for table in tables):
            record_full_table_violation(session, restaurant, item["booking_id"])
        active.add((item["booking_id"], item["table_id"]))
        inserted = session.execute(text("""INSERT INTO table_booking_incidents
            (restaurant_id,booking_id,table_id,created_at) VALUES (:rid,:bid,:tid,CURRENT_TIMESTAMP)
            ON CONFLICT (booking_id,table_id) DO UPDATE SET state='open',cleared_at=NULL
            RETURNING id, (xmax = 0) AS inserted"""), {"rid":restaurant.id,"bid":item["booking_id"],"tid":item["table_id"]}).first()
        if inserted.inserted:
            session.add(Notification(userId=restaurant.manager_id, bookingId=item["booking_id"],
                title="Xung đột bàn khi khách đến giờ dùng bữa", type="table_conflict",
                message=f"Bàn {item['table_name']} dành cho đơn #{item['booking_id']} ({item['customer']}) đang có bill hoặc đơn giữ chỗ khác. Mở mục Xung đột bàn để đề xuất phương án gửi admin.",
                createdAt=datetime.now(APP_TIME_ZONE).isoformat()))
    opened = session.execute(text("SELECT id,booking_id,table_id FROM table_booking_incidents WHERE restaurant_id=:rid AND state='open'"), {"rid":restaurant.id}).all()
    for issue in opened:
        if (issue.booking_id,issue.table_id) not in active:
            session.execute(text("UPDATE table_booking_incidents SET state='cleared',cleared_at=CURRENT_TIMESTAMP WHERE id=:id"), {"id":issue.id})
    return reservations


def maintain_table_reservations(session):
    restaurants = session.exec(select(Restaurant).where(Restaurant.id.in_(select(Booking.restaurantId).where(Booking.status == "confirmed"))).with_for_update(skip_locked=True)).all()
    for restaurant in restaurants:
        sync_table_reservations(session, restaurant)
    # Clear holds/conflicts when the last confirmed booking was completed or cancelled.
    issue_restaurants = session.execute(text("SELECT DISTINCT restaurant_id FROM table_booking_incidents WHERE state='open'")).scalars().all()
    others = session.exec(select(Restaurant).where(Restaurant.id.in_(issue_restaurants)).with_for_update(skip_locked=True)).all() if issue_restaurants else []
    for restaurant in others:
        if restaurant.id not in {r.id for r in restaurants}:
            sync_table_reservations(session, restaurant)
    session.commit()
    suspend_unexplained_table_violations(session)
    session.commit()
