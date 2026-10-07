"""Restaurant-scoped POS workspace with optimistic concurrency."""
from typing import Annotated, Literal
from fastapi import APIRouter, HTTPException, Security, BackgroundTasks
from pydantic import BaseModel, Field, EmailStr, model_validator
from sqlalchemy import text
from sqlmodel import select
from models.restaurantTable import RestaurantTable
from database import SessionDep
from models.user import User
from routers.deps import get_current_user
from routers.restaurant_tables import managed_restaurant
import json
from core.table_reservations import due_reservations, validate_reserved_orders

router = APIRouter(prefix="/v1/cashier", tags=["Cashier"])


class BookingTableChoice(BaseModel):
    table_id: int | None = Field(default=None, gt=0)
    allow_insufficient: bool = False


@router.get("/bookings")
def online_bookings(session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])], limit: int = 10, offset: int = 0):
    from models.booking import Booking
    from models.restaurantTable import BookingTable
    from sqlalchemy import func
    restaurant = managed_restaurant(session, user, lock=False)
    conditions = (Booking.restaurantId == restaurant.id, Booking.userId != None)
    total = session.exec(select(func.count(Booking.bookingId)).where(*conditions)).one()
    rows = session.exec(select(Booking).where(*conditions).order_by(Booking.bookingId.desc()).offset(max(0, offset)).limit(min(50, max(1, limit)))).all()
    items = []
    for booking in rows:
        tables = session.exec(select(RestaurantTable).join(BookingTable, BookingTable.table_id == RestaurantTable.id).where(BookingTable.booking_id == booking.bookingId)).all()
        items.append({**booking.model_dump(), "tables": [{"id": table.id, "name": table.name, "seats": table.seats} for table in tables]})
    return {"items": items, "total": total}


@router.get("/bookings/{booking_id}")
def online_booking_detail(booking_id: int, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    from models.booking import Booking
    from models.restaurantTable import BookingTable
    from routers.booking import _serialize_booking
    restaurant = managed_restaurant(session, user, lock=False)
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id, Booking.restaurantId == restaurant.id, Booking.userId != None)).first()
    if not booking:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn online của nhà hàng.")
    detail = _serialize_booking(session, booking).model_dump()
    tables = session.exec(select(RestaurantTable).join(BookingTable, BookingTable.table_id == RestaurantTable.id).where(BookingTable.booking_id == booking_id)).all()
    return {**detail, "tables": [{"id": table.id, "name": table.name, "seats": table.seats} for table in tables]}


@router.put("/bookings/{booking_id}/confirm")
def confirm_online_booking(booking_id: int, data: BookingTableChoice, background_tasks: BackgroundTasks, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    from models.booking import Booking
    from core.booking_table_assignment import assign_booking_tables
    from routers.booking import confirm_booking
    restaurant = managed_restaurant(session, user)
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id, Booking.restaurantId == restaurant.id, Booking.userId != None).with_for_update()).first()
    if not booking:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn online của nhà hàng.")
    if booking.status != "pending":
        raise HTTPException(409, "Chỉ có thể xác nhận đơn đang chờ duyệt.")
    assign_booking_tables(session, restaurant, booking, data.table_id, data.allow_insufficient)
    return confirm_booking(background_tasks, booking_id, user, session)


@router.put("/bookings/{booking_id}/table")
def change_online_booking_table(booking_id: int, data: BookingTableChoice, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    from models.booking import Booking
    from core.booking_table_assignment import assign_booking_tables
    from core.booking_capacity import booking_window, APP_TIME_ZONE
    from datetime import datetime
    restaurant = managed_restaurant(session, user)
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id, Booking.restaurantId == restaurant.id, Booking.userId != None).with_for_update()).first()
    if not booking or booking.status != "confirmed":
        raise HTTPException(409, "Chỉ được chọn bàn cho đơn đã xác nhận.")
    if not restaurant.is_active or restaurant.is_report_suspended:
        raise HTTPException(409, "Nhà hàng đang ngưng hoạt động.")
    if booking_window(booking.date, booking.time, 120)[0] <= datetime.now(APP_TIME_ZONE):
        raise HTTPException(409, "Đơn đã tới giờ dùng bữa. Hãy xử lý bàn tại khu vực thu ngân.")
    tables = assign_booking_tables(session, restaurant, booking, data.table_id, data.allow_insufficient)
    session.commit()
    return {"tables": [{"id": table.id, "name": table.name} for table in tables]}
@router.put("/bookings/{booking_id}/arrive")
def arrive_online_booking(booking_id: int, data: BookingTableChoice, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    from datetime import datetime
    from copy import deepcopy
    from models.booking import Booking
    from models.restaurantTable import BookingTable
    from core.booking_capacity import booking_window, APP_TIME_ZONE
    from core.booking_table_assignment import assign_booking_tables
    from core.table_reservations import sync_table_reservations
    restaurant = managed_restaurant(session, user)
    # Enforce the deadline even if the maintenance worker has not run yet.
    if getattr(restaurant, "booking_hold_minutes", None) is not None:
        sync_table_reservations(session, restaurant)
        session.commit()
        restaurant = managed_restaurant(session, user)
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id, Booking.restaurantId == restaurant.id, Booking.userId != None).with_for_update()).first()
    if not booking or booking.status != "confirmed":
        raise HTTPException(409, "Chỉ được tiếp nhận khách của đơn đã xác nhận.")
    if not restaurant.is_active or restaurant.is_report_suspended or restaurant.approval_status != "approved":
        raise HTTPException(409, "Nhà hàng đang ngưng hoạt động hoặc chưa được duyệt.")
    if booking_window(booking.date, booking.time, 120)[0] > datetime.now(APP_TIME_ZONE):
        raise HTTPException(409, "Chưa tới giờ dùng bữa của đơn đặt bàn.")
    current = session.exec(select(RestaurantTable).join(BookingTable, BookingTable.table_id == RestaurantTable.id).where(BookingTable.booking_id == booking_id, RestaurantTable.restaurant_id == restaurant.id)).all()
    row = session.execute(text("SELECT data FROM cashier_workspaces WHERE restaurant_id=:id FOR UPDATE"), {"id": restaurant.id}).first()
    workspace = deepcopy(row.data) if row else {"orders": {}, "shifts": []}
    orders = workspace.setdefault("orders", {})
    blocked = {int(key) for key, order in orders.items() if order.get("bookingId") != booking_id and (order.get("lines") or order.get("kitchenLines") or order.get("bookingId"))}
    active_tables = session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).all()
    if active_tables and all(table.id in blocked and (orders.get(str(table.id), {}).get("lines") or orders.get(str(table.id), {}).get("kitchenLines")) for table in active_tables):
        from core.table_reservations import record_full_table_violation
        record_full_table_violation(session, restaurant, booking_id)
        sync_table_reservations(session, restaurant)
        session.commit()
        raise HTTPException(409, "Tất cả bàn đang có bill. Không thể tiếp nhận khách. Nhà hàng cần gửi phương án và giải trình cho admin trong 24 giờ để tránh bị dừng hoạt động.")
    tables = assign_booking_tables(session, restaurant, booking, data.table_id, data.allow_insufficient, blocked) if data.table_id is not None or len(current) != 1 else current
    if any(not table.is_active for table in tables):
        raise HTTPException(409, "Bàn hiện tại không còn phù hợp. Vui lòng chọn bàn khác.")
    if sum(table.seats for table in tables) < booking.requestSeats and not data.allow_insufficient:
        raise HTTPException(409, {"code": "INSUFFICIENT_TABLE_SEATS", "message": "Bàn hiện tại không đủ ghế cho đơn đặt bàn, bạn vẫn muốn tiếp tục?"})
    target_keys = {str(table.id) for table in tables}
    for hold in due_reservations(session, restaurant.id):
        if str(hold["table_id"]) in target_keys and hold["booking_id"] != booking_id:
            raise HTTPException(409, "Bàn đã được giữ cho đơn khác. Vui lòng chọn bàn khác.")
    for key in target_keys:
        order = orders.get(key, {})
        if order.get("bookingId") != booking_id and (order.get("lines") or order.get("kitchenLines") or order.get("bookingId")):
            raise HTTPException(409, "Bàn đang có bill hoặc khách khác. Vui lòng chọn bàn khác.")
    moving = [(key, order) for key, order in orders.items() if order.get("bookingId") == booking_id and key not in target_keys]
    populated = [order for _, order in moving if order.get("lines") or order.get("kitchenLines")]
    primary = str(min(table.id for table in tables))
    if populated:
        existing = orders.get(primary, {})
        if len(populated) > 1 or existing.get("lines") or existing.get("kitchenLines"):
            raise HTTPException(409, "Đơn đang có nhiều bill. Hãy xử lý chuyển bàn tại khu vực thu ngân.")
        orders[primary] = populated[0]
    elif moving and primary not in orders:
        orders[primary] = moving[0][1]
    for key, _ in moving:
        del orders[key]
    session.execute(text("""INSERT INTO cashier_workspaces (restaurant_id,version,data)
        VALUES (:rid,1,CAST(:data AS jsonb)) ON CONFLICT (restaurant_id)
        DO UPDATE SET data=EXCLUDED.data,version=cashier_workspaces.version+1"""), {"rid": restaurant.id, "data": json.dumps(workspace, ensure_ascii=False)})
    booking.attendance = "arrived"
    session.add(booking)
    session.flush()
    sync_table_reservations(session, restaurant)
    session.commit()
    return {"table_id": int(primary), "tables": [{"id": table.id, "name": table.name} for table in tables], "attendance": "arrived"}


PAYMENT_METHODS = {"Tiền mặt", "Chuyển khoản", "ATM", "Apple Pay", "Visa"}

class PaymentSettings(BaseModel):
    available_methods: list[str] | None = Field(default=None, min_length=1, max_length=30)
    enabled_methods: list[str] = Field(min_length=1, max_length=30)
    default_method: str

    @model_validator(mode="after")
    def validate_methods(self):
        self.available_methods = self.available_methods or list(self.enabled_methods)
        for methods in (self.available_methods, self.enabled_methods):
            if any(not name.strip() or len(name) > 30 or not name.isprintable() or name != name.strip() for name in methods):
                raise ValueError("Tên phương thức phải từ 1 đến 30 ký tự, không có ký tự điều khiển")
            if len({name.casefold() for name in methods}) != len(methods):
                raise ValueError("Tên phương thức thanh toán không được trùng nhau")
        if not set(self.enabled_methods) <= set(self.available_methods):
            raise ValueError("Danh sách phương thức thanh toán không hợp lệ")
        if self.default_method not in self.enabled_methods:
            raise ValueError("Phương thức mặc định phải được bật")
        return self

@router.get("/payment-settings", response_model=PaymentSettings)
def get_payment_settings(session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = managed_restaurant(session, user, lock=False)
    return PaymentSettings(available_methods=restaurant.cashier_payment_method_options, enabled_methods=restaurant.cashier_payment_methods, default_method=restaurant.cashier_default_payment_method)

@router.put("/payment-settings", response_model=PaymentSettings)
def update_payment_settings(payload: PaymentSettings, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = managed_restaurant(session, user)
    restaurant.cashier_payment_methods = payload.enabled_methods
    restaurant.cashier_default_payment_method = payload.default_method
    restaurant.cashier_payment_method_options = payload.available_methods
    session.add(restaurant)
    session.commit()
    return payload

class Line(BaseModel):
    id: int
    name: str = Field(max_length=255)
    price: float = Field(ge=0, allow_inf_nan=False)
    category: str
    image_url: str | None = None
    is_available: bool
    quantity: int = Field(ge=1, le=10000)

class Order(BaseModel):
    depositCredit: float = Field(default=0, ge=0, allow_inf_nan=False)
    bookingId: int | None = Field(default=None, ge=1)
    preordersImported: bool = False
    openedAt: str | None = None
    lines: list[Line]
    note: str = Field(max_length=5000)
    discount: float = Field(ge=0, allow_inf_nan=False)
    guests: int = Field(ge=1, le=10000)
    vat: float = Field(ge=0, le=100, allow_inf_nan=False)
    kitchenLines: list[Line] | None = None
    kitchenNote: str | None = Field(default=None, max_length=5000)
    kitchenConfirmedAt: str | None = None
    kitchenTicket: list[str] | None = None
    kitchenPrintCount: int | None = Field(default=None, ge=0)

class InvoiceRequest(BaseModel):
    buyerType: Literal["company", "individual"]
    email: EmailStr | Literal[""] = ""
    customerName: str = Field(default="", max_length=255)
    companyName: str = Field(default="", max_length=255)
    taxCode: str = Field(default="", max_length=255)
    address: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=255)
    bankName: str = Field(default="", max_length=255)
    bankAccount: str = Field(default="", max_length=255)
    budgetCode: str = Field(default="", max_length=255)
    identityNumber: str = Field(default="", max_length=255)
    passportNumber: str = Field(default="", max_length=255)
    note: str = Field(default="", max_length=2000)
    requestedAt: str
    status: Literal["requested"] = "requested"

    @model_validator(mode="after")
    def validate_buyer(self):
        if self.buyerType == "company" and not all(value.strip() for value in (self.companyName, self.taxCode, self.address)):
            raise ValueError("Tên công ty, mã số thuế và địa chỉ là bắt buộc")
        if self.buyerType == "individual" and not self.customerName.strip():
            raise ValueError("Tên khách hàng là bắt buộc")
        return self

class Bill(Order):
    invoiceRequest: InvoiceRequest | None = None
    invoiceSkipped: bool = False
    cashier: str | None = None
    id: str
    table: str
    time: str
    method: str

class Flow(BaseModel):
    id: str
    amount: float = Field(gt=0, allow_inf_nan=False)
    method: str
    reason: str = Field(min_length=1, max_length=5000)
    type: str = Field(pattern="^(Thu|Chi)$")
    time: str

class Shift(BaseModel):
    openedBy: str | None = Field(default=None, max_length=255)
    closedBy: str | None = Field(default=None, max_length=255)
    id: str
    opened: str
    closed: str | None = None
    opening: float = Field(ge=0, allow_inf_nan=False)
    counted: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    bills: list[Bill]
    flows: list[Flow]

class State(BaseModel):
    orders: dict[str, Order]
    shifts: list[Shift]

class Workspace(BaseModel):
    version: int = Field(ge=0)
    data: State

@router.get("/workspace")
def get_workspace(session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = managed_restaurant(session, user, lock=False)
    row = session.execute(text("SELECT version, data FROM cashier_workspaces WHERE restaurant_id=:id"), {"id": restaurant.id}).first()
    from core.cashier_deposits import apply_deposit_credits
    return {"version": row.version, "data": apply_deposit_credits(session, restaurant.id, row.data)} if row else {"version": 0, "data": {"orders": {}, "shifts": []}}

class TableOrderUpdate(BaseModel):
    version: int = Field(ge=0)
    order: Order | None

@router.put("/tables/{table_id}/order")
def save_table_order(table_id: int, payload: TableOrderUpdate, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = managed_restaurant(session, user)
    table = session.exec(select(RestaurantTable.id).where(RestaurantTable.id == table_id, RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).first()
    if table is None:
        raise HTTPException(404, "Không tìm thấy bàn đang hoạt động của nhà hàng")
    order = payload.order
    if order is not None:
        order.vat = 8 if restaurant.vat_enabled else 0
    data = order.model_dump(exclude_none=True) if order is not None else None
    if data is not None:
        data["depositCredit"] = 0
        if data.get("bookingId"):
            from core.cashier_deposits import apply_deposit_credits
            current = session.execute(text("SELECT data FROM cashier_workspaces WHERE restaurant_id=:rid"), {"rid": restaurant.id}).first()
            snapshot = {"orders": {str(table_id): data}, "shifts": current.data.get("shifts", []) if current else []}
            apply_deposit_credits(session, restaurant.id, snapshot)
    if data is not None and data.get("lines"):
        holds = due_reservations(session, restaurant.id)
        if any(hold["table_id"] == table_id for hold in holds):
            previous = session.execute(text("SELECT data->'orders'->:key AS previous_order FROM cashier_workspaces WHERE restaurant_id=:rid"), {"key":str(table_id),"rid":restaurant.id}).first()
            validate_reserved_orders(holds, {str(table_id):previous.previous_order or {}} if previous else {}, {str(table_id):data})
    # Atomic version check and one JSONB path update: no full history transfer,
    # history validation; reservation checks only load the affected order when needed.
    expression = "jsonb_set(data, ARRAY['orders', :table_key], CAST(:order_data AS jsonb), true)" if data is not None else "data #- ARRAY['orders', :table_key]"
    values = {"restaurant_id": restaurant.id, "version": payload.version, "table_key": str(table_id)}
    if data is not None:
        values["order_data"] = json.dumps(data, ensure_ascii=False)
    row = session.execute(text(f"UPDATE cashier_workspaces SET data={expression}, version=version+1 WHERE restaurant_id=:restaurant_id AND version=:version RETURNING version"), values).first()
    if row is None:
        session.rollback()
        raise HTTPException(409, "Dữ liệu thu ngân đã thay đổi. Tải lại trước khi thao tác tiếp.")
    version = row.version
    session.commit()
    return {"version": version, "table_id": table_id, "order": data}

@router.put("/workspace")
def save_workspace(payload: Workspace, background_tasks: BackgroundTasks, session: SessionDep, user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = managed_restaurant(session, user)
    row = session.execute(text("SELECT version, data FROM cashier_workspaces WHERE restaurant_id=:id FOR UPDATE"), {"id": restaurant.id}).first()
    version = row.version if row else 0
    if version != payload.version:
        raise HTTPException(409, "Dữ liệu thu ngân đã thay đổi ở thiết bị khác. Tải lại trang trước khi thao tác tiếp.")
    previous_open = {shift["id"] for shift in (row.data.get("shifts", []) if row else []) if not shift.get("closed")}
    for shift in payload.data.shifts:
        if shift.id in previous_open and shift.closed:
            if any(order.lines or order.kitchenLines for order in payload.data.orders.values()):
                raise HTTPException(422, "Cần thanh toán hết bàn và xác nhận món hủy trước khi chốt ca.")
            if any(not bill.invoiceRequest and not bill.invoiceSkipped for bill in shift.bills):
                raise HTTPException(422, "Cần xử lý xuất hóa đơn hoặc bỏ qua tất cả bill trong ca trước khi chốt ca.")
    # Current table orders and newly paid bills follow restaurant settings.
    # Existing paid bills retain their original tax, including when edited.
    vat = 8 if restaurant.vat_enabled else 0
    previous_bills = {
        bill["id"]: bill
        for shift in (row.data.get("shifts", []) if row else [])
        for bill in shift.get("bills", [])
    }
    for order in payload.data.orders.values():
        order.vat = vat
    for shift in payload.data.shifts:
        for bill in shift.bills:
            bill.vat = previous_bills[bill.id]["vat"] if bill.id in previous_bills else vat
    data = payload.data.model_dump(exclude_none=True)
    validate_reserved_orders(due_reservations(session,restaurant.id), row.data.get("orders",{}) if row else {}, data["orders"])
    if sum(1 for shift in payload.data.shifts if not shift.closed) > 1:
        raise HTTPException(422, "Chỉ được mở một ca tại một thời điểm.")
    previous_methods = {
        (kind, item["id"]): item["method"]
        for shift in (row.data.get("shifts", []) if row else [])
        for kind in ("bills", "flows")
        for item in shift.get(kind, [])
    }
    for shift in payload.data.shifts:
        for kind, items in (("bills", shift.bills), ("flows", shift.flows)):
            for item in items:
                if item.method != previous_methods.get((kind, item.id)) and item.method not in restaurant.cashier_payment_methods:
                    raise HTTPException(422, "Phương thức thanh toán đã bị tắt. Hãy chọn phương thức đang hoạt động.")
    from core.cashier_booking_completion import complete_paid_bookings
    from core.cashier_deposits import apply_deposit_credits
    from core.booking_email import deliver_booking_emails_background
    apply_deposit_credits(session, restaurant.id, data, row.data if row else {})
    completed = complete_paid_bookings(session, restaurant.id, row.data if row else {}, data)
    values = {"id": restaurant.id, "version": version + 1, "data": json.dumps(data, ensure_ascii=False)}
    session.execute(text("INSERT INTO cashier_workspaces (restaurant_id, version, data) VALUES (:id, :version, CAST(:data AS jsonb)) ON CONFLICT (restaurant_id) DO UPDATE SET version=EXCLUDED.version, data=EXCLUDED.data"), values)
    session.commit()
    for booking_id in completed:
        background_tasks.add_task(deliver_booking_emails_background, booking_id)
    return {"version": version + 1, "data": data}
