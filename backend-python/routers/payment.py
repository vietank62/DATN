from datetime import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Depends, Security, Header, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel  # type: ignore
from database import SessionDep
from models import Payment, Booking, Restaurant, User
from routers.authentication import get_current_user
from sqlmodel import select # type: ignore
import os
import re
import hmac
import hashlib
import base64

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# Webhook payload schema defined by SePay
class SePayWebhookPayload(BaseModel):
    id: int
    gateway: str
    transactionDate: str
    accountNumber: str
    transferType: str  # "in" or "out"
    transferAmount: float
    accumulatedBalance: float
    code: str
    content: str
    referenceCode: Optional[str] = None


class PaymentCreateResponse(BaseModel):
    paymentId: int
    restaurantId: int
    amount: float
    transactionCode: str
    status: str


@router.post("/api/payments/create", response_model=PaymentCreateResponse, tags=["Payment"])
def create_payment(
    restaurant_id: int,
    session: SessionDep,
    current_user: Annotated[User, Depends(get_current_user)]
):
    restaurant = session.exec(select(Restaurant).where(Restaurant.id == restaurant_id)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if restaurant.manager_id != current_user.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to pay fees for this restaurant")

    unpaid_bookings = session.exec(
        select(Booking).where(
            Booking.restaurantId == restaurant_id,
            Booking.status == "completed",
            Booking.isPaid == False
        )
    ).all()

    if not unpaid_bookings:
        raise HTTPException(status_code=400, detail="Nhà hàng hiện không có phí đặt bàn nào chưa thanh toán.")

    amount = len(unpaid_bookings) * 6000
    booking_ids_str = ",".join(str(b.bookingId) for b in unpaid_bookings)

    # Cancel existing pending payments
    existing_pendings = session.exec(
        select(Payment).where(Payment.restaurantId == restaurant_id, Payment.status == "pending")
    ).all()
    for p in existing_pendings:
        p.status = "cancelled"
        session.add(p)

    payment = Payment(
        restaurantId=restaurant_id,
        amount=amount,
        transactionCode="TEMP",
        status="pending",
        createdAt=datetime.now().isoformat(timespec="seconds"),
        bookingIds=booking_ids_str
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    payment.transactionCode = f"TNPAY{payment.paymentId}"
    session.add(payment)
    session.commit()
    session.refresh(payment)

    return PaymentCreateResponse(
        paymentId=payment.paymentId,
        restaurantId=payment.restaurantId,
        amount=payment.amount,
        transactionCode=payment.transactionCode,
        status=payment.status
    )


@router.get("/api/payments/{payment_id}/status", tags=["Payment"])
def get_payment_status(payment_id: int, session: SessionDep):
    payment = session.exec(select(Payment).where(Payment.paymentId == payment_id)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    return {
        "paymentId": payment.paymentId,
        "status": payment.status,
        "amount": payment.amount,
        "transactionCode": payment.transactionCode,
        "paidAt": payment.paidAt
    }


@router.post("/sepay/ipn", tags=["Payment"])
def sepay_webhook(
    payload: SePayWebhookPayload,
    session: SessionDep,
    authorization: Optional[str] = Header(None)
):
    expected_token = os.getenv("SEPAY_WEBHOOK_TOKEN", "super-secret-sepay-token-123")
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token != expected_token:
            raise HTTPException(status_code=401, detail="Unauthorized webhook request")

    if payload.transferType.lower() != "in":
        return {"success": True, "message": "Ignored transfer type"}

    match = re.search(r"TNPAY\d+", payload.content, re.IGNORECASE)
    if not match:
        return {"success": False, "message": "Transaction code not found in content"}

    tx_code = match.group(0).upper()
    payment = session.exec(select(Payment).where(Payment.transactionCode == tx_code)).first()

    if not payment:
        return {"success": False, "message": f"Payment with code {tx_code} not found"}
    if payment.status == "completed":
        return {"success": True, "message": "Payment already processed"}
    if payment.status == "cancelled":
        return {"success": False, "message": "Payment has been cancelled"}
    if payload.transferAmount < payment.amount:
        return {"success": False, "message": "Insufficient transfer amount"}

    payment.status = "completed"
    payment.paidAt = datetime.now().isoformat(timespec="seconds")
    payment.sepayTransactionId = str(payload.id)
    session.add(payment)

    if payment.bookingIds:
        booking_ids = [int(bid.strip()) for bid in payment.bookingIds.split(",") if bid.strip()]
        if booking_ids:
            bookings = session.exec(select(Booking).where(Booking.bookingId.in_(booking_ids))).all()
            for b in bookings:
                b.isPaid = True
                session.add(b)

    session.commit()
    return {"success": True, "message": "Payment processed successfully", "paymentId": payment.paymentId}


@router.post("/api/sepay/simulate-webhook", tags=["Payment"])
def simulate_webhook(payment_id: int, session: SessionDep):
    """Simulation utility to mock a bank transfer callback from SePay."""
    payment = session.exec(select(Payment).where(Payment.paymentId == payment_id)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    if payment.status == "completed":
        return {"success": True, "message": "Payment is already completed"}
    if payment.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot simulate a cancelled payment")

    payload = SePayWebhookPayload(
        id=999000 + payment.paymentId,
        gateway="MBBank",
        transactionDate=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        accountNumber=os.getenv("SEPAY_ACCOUNT_NO", "1903829188888"),
        transferType="in",
        transferAmount=payment.amount,
        accumulatedBalance=1000000.0,
        code=f"SIMULATED_TX_{payment.paymentId}",
        content=f"Chuyen tien phi dich vu {payment.transactionCode}",
        referenceCode=f"REF_{payment.paymentId}"
    )
    result = sepay_webhook(payload=payload, session=session, authorization=None)
    return {"message": "Simulation executed successfully", "webhookResult": result}


@router.get("/api/payments/{payment_id}/checkout-fields", tags=["Payment"])
def get_checkout_fields(payment_id: int, session: SessionDep, request: Request):
    payment = session.exec(select(Payment).where(Payment.paymentId == payment_id)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")

    merchant_id = os.getenv("SEPAY_MERCHANT_ID")
    secret_key = os.getenv("SEPAY_SECRET_KEY")
    if not merchant_id or not secret_key:
        raise HTTPException(status_code=500, detail="Cấu hình SePay Merchant ID hoặc Secret Key chưa được khai báo")

    sepay_env = os.getenv("SEPAY_ENV", "sandbox")
    checkout_url = "https://checkout.sepay.vn/payment" if sepay_env == "production" else "https://sandbox.sepay.vn/checkout"

    base_url = str(request.base_url).rstrip('/')
    success_url = f"{base_url}/api/payment/success?id={payment.paymentId}"
    error_url = f"{base_url}/api/payment/error?id={payment.paymentId}"
    cancel_url = f"{base_url}/api/payment/cancel?id={payment.paymentId}"

    fields = {
        "merchant": merchant_id,
        "operation": "PURCHASE",
        "payment_method": "BANK_TRANSFER",
        "order_invoice_number": f"TNPAY{payment.paymentId}",
        "order_amount": str(int(payment.amount)),
        "currency": "VND",
        "order_description": f"Thanh toan phi dat ban TNPAY{payment.paymentId}",
        "success_url": success_url,
        "error_url": error_url,
        "cancel_url": cancel_url,
        "customer_id": str(payment.restaurantId)
    }

    concat_keys = [
        "merchant", "operation", "payment_method", "order_amount", "currency",
        "order_invoice_number", "order_description", "customer_id", "success_url",
        "error_url", "cancel_url"
    ]
    concat_str = ",".join(f"{k}={fields[k]}" for k in concat_keys)
    signature_bytes = hmac.new(
        secret_key.encode('utf-8'),
        concat_str.encode('utf-8'),
        hashlib.sha256
    ).digest()
    fields["signature"] = base64.b64encode(signature_bytes).decode('utf-8')

    return {"checkoutUrl": checkout_url, "fields": fields}


def get_payment_html_view(status: str, title: str, message: str, color_theme: str) -> str:
    theme_map = {
        "success": ("#10b981", "🎉", "Thanh toán Thành công"),
        "error": ("#ef4444", "❌", "Thanh toán Thất bại"),
    }
    theme_color, icon, badge_text = theme_map.get(color_theme, ("#f59e0b", "⚠️", "Giao dịch đã hủy"))
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="5;url={FRONTEND_URL}/manager/dashboard" />
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: 'Outfit', sans-serif; background: linear-gradient(135deg,#111827,#030712); color:#f9fafb; min-height:100vh; display:flex; align-items:center; justify-content:center; }}
        .card {{ background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:28px; padding:48px; max-width:460px; width:92%; text-align:center; }}
        .icon {{ font-size:52px; margin-bottom:20px; }}
        .badge {{ display:inline-block; padding:6px 16px; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-size:12px; font-weight:700; color:{theme_color}; margin-bottom:20px; text-transform:uppercase; }}
        h1 {{ font-size:24px; font-weight:800; margin-bottom:12px; }}
        p {{ font-size:14px; color:#9ca3af; margin-bottom:32px; line-height:1.6; }}
        .btn {{ display:block; padding:14px; background:{theme_color}; color:#fff; text-decoration:none; border-radius:14px; font-weight:700; }}
        .footer {{ margin-top:20px; font-size:12px; color:#4b5563; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">{icon}</div>
        <div class="badge">{badge_text}</div>
        <h1>{title}</h1>
        <p>{message}</p>
        <a href="{FRONTEND_URL}/manager/dashboard?payment={color_theme}&id={status}" class="btn">Quay lại Dashboard</a>
        <div class="footer">Tự động chuyển hướng sau 5 giây...</div>
    </div>
</body>
</html>"""


@router.get("/api/payment/success", response_class=HTMLResponse, tags=["Payment"])
def payment_success(id: int):
    return get_payment_html_view(str(id), "Thanh toán Thành công!", f"Hóa đơn #{id} đã được thanh toán thành công.", "success")


@router.get("/api/payment/error", response_class=HTMLResponse, tags=["Payment"])
def payment_error(id: int):
    return get_payment_html_view(str(id), "Thanh toán Thất bại", f"Giao dịch #{id} gặp lỗi. Vui lòng thử lại.", "error")


@router.get("/api/payment/cancel", response_class=HTMLResponse, tags=["Payment"])
def payment_cancel(id: int):
    return get_payment_html_view(str(id), "Giao dịch đã hủy", f"Bạn đã hủy giao dịch #{id}.", "cancel")
