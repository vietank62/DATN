import time
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Security, Header
from pydantic import BaseModel, Field
from database import SessionDep
from models.user import User
from models.managementAccess import ManagementAccess
from routers.deps import get_current_user
from core.security import verify_password, get_password_hash, create_access_token
from core.management_access import credential_fingerprint, verify_management_token

router = APIRouter(prefix="/v1/management-access", tags=["Management access"])
Manager = Annotated[User, Security(get_current_user, scopes=["manager"])]


class UnlockRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


@router.get("/status")
def access_status(user: Manager, session: SessionDep):
    record = session.get(ManagementAccess, user.userId)
    return {"configured": bool(record and record.password_hash)}


@router.post("/unlock")
def unlock(data: UnlockRequest, user: Manager, session: SessionDep):
    # Serialize verification so concurrent guesses share the same lockout counter.
    from sqlmodel import select
    session.exec(select(User).where(User.userId == user.userId).with_for_update()).first()
    record = session.get(ManagementAccess, user.userId)
    if record is None:
        record = ManagementAccess(user_id=user.userId)
    if record.locked_until > time.time():
        raise HTTPException(429, "Nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.")
    password_hash = record.password_hash or user.password
    if not verify_password(data.password, password_hash):
        record.failed_attempts += 1
        if record.failed_attempts >= 5:
            record.locked_until = time.time() + 300
            record.failed_attempts = 0
        session.add(record)
        session.commit()
        raise HTTPException(400, "Mật khẩu quản lý không chính xác.")
    record.failed_attempts = 0
    record.locked_until = 0
    session.add(record)
    session.commit()
    token = create_access_token({"type": "management", "uid": user.userId, "credential": credential_fingerprint(user, record)}, timedelta(minutes=30))
    from core.security import decode_token
    return {"token": token, "expires_at": decode_token(token)["exp"]}


@router.get("/session")
def validate_session(user: Manager, session: SessionDep, x_management_token: Annotated[str | None, Header()] = None):
    payload = verify_management_token(x_management_token, user, session)
    return {"valid": True, "expires_at": payload["exp"]}


@router.put("/password")
def change_password(data: ChangePasswordRequest, user: Manager, session: SessionDep):
    from sqlmodel import select
    session.exec(select(User).where(User.userId == user.userId).with_for_update()).first()
    record = session.get(ManagementAccess, user.userId)
    if record is None:
        record = ManagementAccess(user_id=user.userId)
    if record.locked_until > time.time():
        raise HTTPException(429, "Nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.")
    if not verify_password(data.current_password, record.password_hash or user.password):
        record.failed_attempts += 1
        if record.failed_attempts >= 5:
            record.locked_until = time.time() + 300
            record.failed_attempts = 0
        session.add(record)
        session.commit()
        raise HTTPException(400, "Mật khẩu quản lý hiện tại không chính xác.")
    if verify_password(data.new_password, user.password):
        raise HTTPException(400, "Mật khẩu quản lý phải khác mật khẩu đăng nhập.")
    record.password_hash = get_password_hash(data.new_password)
    record.failed_attempts = 0
    record.locked_until = 0
    session.add(record)
    session.commit()
    return {"updated": True}
