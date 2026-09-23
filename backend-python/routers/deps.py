from typing import Annotated
from fastapi import Depends, HTTPException, status, Security, Header
from fastapi.security import SecurityScopes
from sqlmodel import select  # type: ignore
from core.security import oauth2_scheme, decode_token
from database import SessionDep
from models.user import User

def _user_from_token(token: str, session: SessionDep) -> User:
    payload = decode_token(token)
    email = payload.get("email")
    if not email: raise HTTPException(status_code=401, detail="Could not validate credentials")
    user = session.exec(select(User).where(User.email == email)).first()
    if not user: raise HTTPException(status_code=401, detail="Could not validate credentials")
    return user

async def get_current_user(security_scopes: SecurityScopes, token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> User:
    authenticate_value = f'Bearer scope="{security_scopes.scope_str}"' if security_scopes.scopes else "Bearer"
    user = _user_from_token(token, session)
    if user.isSuspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đang bị tạm chặn. Bạn chỉ có thể gửi giải trình.")
    token_scopes = decode_token(token).get("scopes", [])
    for scope in security_scopes.scopes:
        if scope not in token_scopes: raise HTTPException(status_code=401, detail="Not enough permissions", headers={"WWW-Authenticate": authenticate_value})
    return user

async def get_current_user_including_suspended(token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> User:
    return _user_from_token(token, session)

async def get_optional_current_user(authorization: Annotated[str | None, Header()] = None, session: SessionDep = None) -> User | None:  # type: ignore
    if not authorization or not authorization.startswith("Bearer "): return None
    try:
        user = _user_from_token(authorization.removeprefix("Bearer ").strip(), session)
        return None if user.isSuspended else user
    except HTTPException: return None
