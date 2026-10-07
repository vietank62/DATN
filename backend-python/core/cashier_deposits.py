"""Allocate verified booking deposits once across POS bills and split payments."""
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlmodel import select
from models.booking import Booking
from models.depositPayment import DepositPayment


def bill_total(bill):
    subtotal = sum(Decimal(str(line["price"])) * line["quantity"] for line in bill.get("lines", []))
    net = max(Decimal(0), subtotal - Decimal(str(bill.get("discount", 0))))
    tax = (net * Decimal(str(bill.get("vat", 0))) / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return float(net + tax)


def apply_deposit_credits(session, restaurant_id, data, previous=None):
    old_bills = {b["id"]: b for s in (previous or data).get("shifts", []) for b in s.get("bills", [])}
    bills = [b for s in data.get("shifts", []) for b in s.get("bills", [])]
    current_ids = {b["id"] for b in bills}
    if len(current_ids) != len(bills):
        raise HTTPException(409, "Mã bill không được trùng nhau.")
    if previous is not None and any(b.get("depositCredit", 0) > 0 and key not in current_ids for key, b in old_bills.items()):
        raise HTTPException(409, "Không thể xóa bill đã khấu trừ tiền cọc.")
    used = {}
    for bill in old_bills.values():
        bid = bill.get("bookingId")
        if bid:
            used[bid] = used.get(bid, 0) + bill.get("depositCredit", 0)
    new_bills = [b for b in bills if b["id"] not in old_bills]
    ids = {o.get("bookingId") for o in data.get("orders", {}).values()} | {b.get("bookingId") for b in new_bills}
    ids.discard(None)
    balances = {}
    if ids:
        rows = session.exec(select(Booking, DepositPayment).join(DepositPayment, DepositPayment.booking_id == Booking.bookingId).where(Booking.bookingId.in_(ids), Booking.restaurantId == restaurant_id, DepositPayment.restaurant_id == restaurant_id, Booking.depositStatus == "paid", DepositPayment.status == "paid").with_for_update()).all()
        balances = {b.bookingId: max(0, min(b.depositAmount, p.amount) - used.get(b.bookingId, 0)) for b, p in rows}
    linked = {o.get("bookingId") for o in (previous or {}).get("orders", {}).values()}
    for bill in bills:
        old = old_bills.get(bill["id"])
        if old is not None:
            credit = old.get("depositCredit", 0)
            if credit and (bill.get("bookingId") != old.get("bookingId") or bill_total(bill) < credit):
                raise HTTPException(409, "Bill đã khấu trừ cọc không thể đổi đơn hoặc giảm tổng tiền xuống dưới tiền cọc đã dùng.")
            bill["depositCredit"] = credit
            continue
        bid = bill.get("bookingId")
        if bid and bid not in linked:
            raise HTTPException(409, "Bill không thuộc bàn đang phục vụ của đơn đặt bàn.")
        credit = min(bill_total(bill), balances.get(bid, 0))
        bill["depositCredit"] = credit
        if bid:
            balances[bid] = max(0, balances.get(bid, 0) - credit)
    # Preview the remaining credit on each linked table; settlement above remains authoritative.
    preview_balances = dict(balances)
    for key in sorted(data.get("orders", {})):
        order = data["orders"][key]
        bid = order.get("bookingId")
        credit = min(bill_total(order), preview_balances.get(bid, 0))
        order["depositCredit"] = credit
        if bid:
            preview_balances[bid] = max(0, preview_balances.get(bid, 0) - credit)
    return data
