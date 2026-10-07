import hashlib

from fastapi import HTTPException
from core.security import decode_token
from models.managementAccess import ManagementAccess


def credential_fingerprint(user, record):
    value = (record.password_hash if record and record.password_hash else user.password) + user.password
    return hashlib.sha256(value.encode()).hexdigest()


def verify_management_token(token, user, session):
    try:
        payload = decode_token(token or "")
    except HTTPException:
        raise HTTPException(403, "Vui lòng nhập mật khẩu quản lý để vào quản trị nhà hàng.", headers={"X-Error-Code": "MANAGEMENT_LOCKED"}) from None
    record = session.get(ManagementAccess, user.userId)
    if payload.get("type") != "management" or payload.get("uid") != user.userId or payload.get("credential") != credential_fingerprint(user, record):
        raise HTTPException(403, "Vui lòng nhập lại mật khẩu quản lý.", headers={"X-Error-Code": "MANAGEMENT_LOCKED"})
    return payload
