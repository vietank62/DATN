from datetime import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Depends, Security, Header
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from database import SessionDep
from models import Payment, Booking, Restaurant, User
from routers.authentication import get_current_user
from sqlmodel import select
import os
import re
import hmac
import hashlib
import base64


router = APIRouter()

# Webhook payload schema defined by SePay
class SePayWebhookPayload(BaseModel):
    id: int
    gateway: str
    transactionDate: str
    accountNumber: str
    transferType: str  # "in" or "out"
    transferAmount: float
    accumulatedBalance: float
    code: str  # Bank transaction reference
    content: str  # Transfer description
    referenceCode: Optional[str] = None

class PaymentCreateResponse(BaseModel):
    paymentId: int
    restaurantId: int
    amount: float
    transactionCode: str
    status: str

@router.post("/api/payments/create", response_model=PaymentCreateResponse, tags=["Payment"])
async def create_payment(
    restaurant_id: int, 
    session: SessionDep, 
    current_user: Annotated[User, Depends(get_current_user)]
):
    # Verify that the restaurant exists
    rest_res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = rest_res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    # Check that this manager manages this restaurant or is admin
    if restaurant.managerID != current_user.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to pay fees for this restaurant")

    # Fetch completed, unpaid bookings for this restaurant
    unpaid_res = await session.execute(
        select(Booking).where(
            Booking.restaurantId == restaurant_id,
            Booking.status == "completed",
            Booking.isPaid == False
        )
    )
    unpaid_bookings = unpaid_res.scalars().all()
    
    if not unpaid_bookings:
        raise HTTPException(
            status_code=400, 
            detail="Nhà hàng hiện không có phí đặt bàn nào chưa thanh toán."
        )

    amount = len(unpaid_bookings) * 6000
    booking_ids_str = ",".join(str(b.bookingId) for b in unpaid_bookings)

    # Check if there is already a pending payment for the same booking IDs to avoid duplicate payments
    # We can create a new payment transaction anyway because a manager might want to refresh.
    # We will mark other pending payments for this restaurant as cancelled
    existing_pending_res = await session.execute(
        select(Payment).where(
            Payment.restaurantId == restaurant_id,
            Payment.status == "pending"
        )
    )
    existing_pendings = existing_pending_res.scalars().all()
    for p in existing_pendings:
        p.status = "cancelled"
        session.add(p)
        
    # Create new Payment transaction record
    payment = Payment(
        restaurantId=restaurant_id,
        amount=amount,
        transactionCode="TEMP",  # will update after getting paymentId
        status="pending",
        createdAt=datetime.now().isoformat(timespec="seconds"),
        bookingIds=booking_ids_str
    )
    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    # Generate the unique transaction code
    payment.transactionCode = f"TNPAY{payment.paymentId}"
    session.add(payment)
    await session.commit()
    await session.refresh(payment)

    return PaymentCreateResponse(
        paymentId=payment.paymentId,
        restaurantId=payment.restaurantId,
        amount=payment.amount,
        transactionCode=payment.transactionCode,
        status=payment.status
    )


@router.get("/api/payments/{payment_id}/status", tags=["Payment"])
async def get_payment_status(payment_id: int, session: SessionDep):
    res = await session.execute(select(Payment).where(Payment.paymentId == payment_id))
    payment = res.scalars().first()
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
async def sepay_webhook(
    payload: SePayWebhookPayload, 
    session: SessionDep, 
    authorization: Optional[str] = Header(None)
):
    # Verify Webhook Token for security
    expected_token = os.getenv("SEPAY_WEBHOOK_TOKEN", "super-secret-sepay-token-123")
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token != expected_token:
            raise HTTPException(status_code=401, detail="Unauthorized webhook request")
    
    # We only handle "in" (receiving money) transfers
    if payload.transferType.lower() != "in":
        return {"success": True, "message": "Ignored transfer type"}

    # Extract transactionCode (TNPAY{payment_id}) from transfer content
    match = re.search(r"TNPAY\d+", payload.content, re.IGNORECASE)
    if not match:
        return {"success": False, "message": "Transaction code not found in content"}
    
    tx_code = match.group(0).upper()
    
    # Query corresponding pending Payment record
    pay_res = await session.execute(select(Payment).where(Payment.transactionCode == tx_code))
    payment = pay_res.scalars().first()
    
    if not payment:
        return {"success": False, "message": f"Payment with code {tx_code} not found"}
        
    if payment.status == "completed":
        return {"success": True, "message": "Payment already processed"}
        
    if payment.status == "cancelled":
        return {"success": False, "message": "Payment has been cancelled"}

    # Check if the transferred amount matches or exceeds the required amount
    if payload.transferAmount < payment.amount:
        return {"success": False, "message": "Insufficient transfer amount"}

    # Mark Payment as completed
    payment.status = "completed"
    payment.paidAt = datetime.now().isoformat(timespec="seconds")
    payment.sepayTransactionId = str(payload.id)
    session.add(payment)

    # Mark associated Bookings as paid
    if payment.bookingIds:
        booking_ids = [int(bid.strip()) for bid in payment.bookingIds.split(",") if bid.strip()]
        if booking_ids:
            bookings_res = await session.execute(
                select(Booking).where(Booking.bookingId.in_(booking_ids))
            )
            bookings = bookings_res.scalars().all()
            for booking in bookings:
                booking.isPaid = True
                session.add(booking)

    await session.commit()
    return {"success": True, "message": "Payment processed successfully", "paymentId": payment.paymentId}

@router.post("/api/sepay/simulate-webhook", tags=["Payment"])
async def simulate_webhook(payment_id: int, session: SessionDep):
    """
    Simulation utility to mock a bank transfer callback from SePay.
    Extremely helpful for development, testing, and UI demonstration.
    """
    pay_res = await session.execute(select(Payment).where(Payment.paymentId == payment_id))
    payment = pay_res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
        
    if payment.status == "completed":
        return {"success": True, "message": "Payment is already completed"}
        
    if payment.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot simulate a cancelled payment")

    # Create dummy SePay webhook payload
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

    # Execute webhook logic directly
    result = await sepay_webhook(payload=payload, session=session, authorization=None)
    return {
        "message": "Simulation executed successfully",
        "sepayPayload": payload,
        "webhookResult": result
    }

@router.get("/api/payments/{payment_id}/checkout-fields", tags=["Payment"])
async def get_checkout_fields(payment_id: int, session: SessionDep):
    pay_res = await session.execute(select(Payment).where(Payment.paymentId == payment_id))
    payment = pay_res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
        
    merchant_id = os.getenv("SEPAY_MERCHANT_ID")
    secret_key = os.getenv("SEPAY_SECRET_KEY")
    if not merchant_id or not secret_key:
        raise HTTPException(
            status_code=500,
            detail="Cấu hình SePay Merchant ID hoặc Secret Key chưa được khai báo trong file .env"
        )
        
    sepay_env = os.getenv("SEPAY_ENV", "sandbox")
    
    # SePay Checkout URL
    if sepay_env == "production":
        checkout_url = "https://checkout.sepay.vn/payment"
    else:
        checkout_url = "https://sandbox.sepay.vn/checkout"
        
    # Callback URLs pointing to our backend landing page endpoints
    success_url = f"http://localhost:8000/api/payment/success?id={payment.paymentId}"
    error_url = f"http://localhost:8000/api/payment/error?id={payment.paymentId}"
    cancel_url = f"http://localhost:8000/api/payment/cancel?id={payment.paymentId}"
    
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
    
    # Sort or format string precisely as: field1=value1,field2=value2,...
    # The keys should be in exact order for concatenation
    concat_keys = [
        "merchant", "operation", "payment_method", "order_amount", "currency",
        "order_invoice_number", "order_description", "customer_id", "success_url",
        "error_url", "cancel_url"
    ]
    
    concat_parts = []
    for k in concat_keys:
        val = fields.get(k, "")
        concat_parts.append(f"{k}={val}")
        
    concat_str = ",".join(concat_parts)
    
    # Calculate HMAC-SHA256 signature
    signature_bytes = hmac.new(
        secret_key.encode('utf-8'),
        concat_str.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    signature = base64.b64encode(signature_bytes).decode('utf-8')
    fields["signature"] = signature
    
    return {
        "checkoutUrl": checkout_url,
        "fields": fields
    }

def get_payment_html_view(status: str, title: str, message: str, color_theme: str) -> str:
    gradient = "linear-gradient(135deg, #111827, #030712)"
    card_bg = "rgba(255, 255, 255, 0.03)"
    border_color = "rgba(255, 255, 255, 0.08)"
    text_color = "#f9fafb"
    
    if color_theme == "success":
        icon = "🎉"
        theme_color = "#10b981"
        badge_text = "Thanh toán Thành công"
    elif color_theme == "error":
        icon = "❌"
        theme_color = "#ef4444"
        badge_text = "Thanh toán Thất bại"
    else:
        icon = "⚠️"
        theme_color = "#f59e0b"
        badge_text = "Giao dịch đã hủy"
        
    html_content = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="5;url=http://localhost:5173/manager/dashboard" />
        <title>{title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            body {{
                font-family: 'Outfit', sans-serif;
                background: {gradient};
                color: {text_color};
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }}
            .card {{
                background: {card_bg};
                backdrop-filter: blur(20px);
                border: 1px solid {border_color};
                border-radius: 28px;
                padding: 48px;
                width: 92%;
                max-width: 460px;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                position: relative;
            }}
            .card::before {{
                content: '';
                position: absolute;
                top: -1px;
                left: -1px;
                right: -1px;
                bottom: -1px;
                background: linear-gradient(135deg, {theme_color}, transparent);
                border-radius: 29px;
                z-index: -1;
                opacity: 0.25;
            }}
            .icon-wrapper {{
                width: 84px;
                height: 84px;
                background: rgba(255,255,255,0.02);
                border: 2px solid {theme_color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 42px;
                margin: 0 auto 24px auto;
                box-shadow: 0 0 30px rgba({ "16,185,129" if color_theme == "success" else "239,68,68" if color_theme == "error" else "245,158,11" }, 0.2);
                animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }}
            @keyframes pop {{
                0% {{ transform: scale(0.5); opacity: 0; }}
                100% {{ transform: scale(1); opacity: 1; }}
            }}
            .badge {{
                display: inline-block;
                padding: 6px 16px;
                background: rgba(255,255,255,0.03);
                border: 1px solid {border_color};
                border-radius: 20px;
                font-size: 12px;
                font-weight: 700;
                color: {theme_color};
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 0.75px;
            }}
            h1 {{
                font-size: 26px;
                font-weight: 800;
                margin-bottom: 12px;
                color: #ffffff;
                letter-spacing: -0.5px;
            }}
            p {{
                font-size: 14.5px;
                color: #9ca3af;
                line-height: 1.6;
                margin-bottom: 36px;
            }}
            .btn {{
                display: inline-block;
                width: 100%;
                padding: 15px;
                background: {theme_color};
                color: #ffffff;
                text-decoration: none;
                border-radius: 14px;
                font-size: 15px;
                font-weight: 700;
                transition: all 0.25s ease;
                box-shadow: 0 10px 20px -10px rgba({ "16,185,129" if color_theme == "success" else "239,68,68" if color_theme == "error" else "245,158,11" }, 0.5);
            }}
            .btn:hover {{
                transform: translateY(-2px);
                filter: brightness(1.15);
                box-shadow: 0 12px 24px -8px rgba({ "16,185,129" if color_theme == "success" else "239,68,68" if color_theme == "error" else "245,158,11" }, 0.6);
            }}
            .footer-info {{
                margin-top: 28px;
                font-size: 12px;
                color: #4b5563;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }}
            .spinner {{
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255,255,255,0.05);
                border-top-color: {theme_color};
                border-radius: 50%;
                display: inline-block;
                animation: spin 1s infinite linear;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon-wrapper">
                {icon}
            </div>
            <div class="badge">{badge_text}</div>
            <h1>{title}</h1>
            <p>{message}</p>
            
            <a href="http://localhost:5173/manager/dashboard?payment={color_theme}&id={status}" class="btn">Quay lại Dashboard ngay</a>
            
            <div class="footer-info">
                <span class="spinner"></span> Tự động chuyển hướng về TableNow sau 5 giây...
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

@router.get("/api/payment/success", response_class=HTMLResponse, tags=["Payment"])
async def payment_success(id: int):
    # This route is hit by success_url redirection from SePay Checkout Gateway
    html_content = get_payment_html_view(
        status=str(id),
        title="Thanh toán Thành công!",
        message=f"Hóa đơn dịch vụ #{id} của bạn đã được thanh toán và ghi nhận thành công vào hệ thống. Chân thành cảm ơn sự đồng hành của bạn!",
        color_theme="success"
    )
    return html_content

@router.get("/api/payment/error", response_class=HTMLResponse, tags=["Payment"])
async def payment_error(id: int):
    # This route is hit by error_url redirection from SePay Checkout Gateway
    html_content = get_payment_html_view(
        status=str(id),
        title="Thanh toán Thất bại",
        message=f"Quá trình xử lý thanh toán cho giao dịch #{id} đã gặp lỗi ngoài ý muốn. Vui lòng kiểm tra lại số dư hoặc thử lại sau.",
        color_theme="error"
    )
    return html_content

@router.get("/api/payment/cancel", response_class=HTMLResponse, tags=["Payment"])
async def payment_cancel(id: int):
    # This route is hit by cancel_url redirection from SePay Checkout Gateway
    html_content = get_payment_html_view(
        status=str(id),
        title="Giao dịch đã hủy",
        message=f"Bạn đã chủ động hủy bỏ yêu cầu giao dịch thanh toán #{id}. Số dư tài khoản của bạn sẽ không bị ảnh hưởng.",
        color_theme="cancel"
    )
    return html_content


