"""SePay Payment Gateway form signing and authenticated REST operations."""
import base64
import hashlib
import hmac
import os
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

SIGNED_FIELDS = (
    "order_amount", "merchant", "currency", "operation", "order_description",
    "order_invoice_number", "customer_id", "payment_method", "success_url",
    "error_url", "cancel_url",
)


def gateway_config():
    merchant = os.getenv("SEPAY_MERCHANT_ID", "").strip()
    secret = os.getenv("SEPAY_SECRET_KEY", "").strip()
    ipn_secret = os.getenv("SEPAY_IPN_SECRET_KEY", "").strip()
    env = os.getenv("SEPAY_ENV", "sandbox").strip().lower()
    frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not merchant or not secret or not ipn_secret:
        raise HTTPException(503, "Chưa cấu hình đầy đủ cổng thanh toán SePay.")
    if env not in {"sandbox", "production"}:
        raise HTTPException(503, "SEPAY_ENV phải là sandbox hoặc production.")
    parsed = urlsplit(frontend)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.query or parsed.fragment:
        raise HTTPException(503, "FRONTEND_URL không hợp lệ.")
    if env == "production" and parsed.scheme != "https":
        raise HTTPException(503, "FRONTEND_URL phải dùng HTTPS khi chạy production.")
    return {
        "merchant": merchant, "secret": secret, "frontend": frontend,
        "checkout": "https://pay.sepay.vn/v1/checkout/init" if env == "production" else "https://pay-sandbox.sepay.vn/v1/checkout/init",
        "api": "https://pgapi.sepay.vn" if env == "production" else "https://pgapi-sandbox.sepay.vn",
    }


def checkout_form(attempt, booking):
    config = gateway_config()
    callback = f"{config['frontend']}/account/bookings/{booking.bookingId}"
    values = {
        "order_amount": str(attempt.amount), "merchant": config["merchant"],
        "currency": "VND", "operation": "PURCHASE",
        "order_description": f"Dat coc don dat ban {booking.bookingId}",
        "order_invoice_number": attempt.invoice_number,
        "customer_id": str(booking.userId), "payment_method": "BANK_TRANSFER",
        "success_url": callback + "?payment=success",
        "error_url": callback + "?payment=error",
        "cancel_url": callback + "?payment=cancel",
    }
    fields = {key: values[key] for key in SIGNED_FIELDS}
    signed = ",".join(f"{key}={value}" for key, value in fields.items())
    fields["signature"] = base64.b64encode(hmac.new(
        config["secret"].encode(), signed.encode(), hashlib.sha256
    ).digest()).decode()
    return {"checkoutUrl": config["checkout"], "fields": fields,
            "expiresAt": attempt.expires_at, "invoiceNumber": attempt.invoice_number}


def cancel_gateway_order(invoice_number: str) -> bool:
    """False means cancellation is not confirmed and must be retried."""
    config = gateway_config()
    try:
        response = httpx.post(config["api"] + "/v1/order/cancel",
            auth=(config["merchant"], config["secret"]),
            json={"order_invoice_number": invoice_number}, timeout=5)
        return response.status_code == 200
    except httpx.HTTPError:
        return False
