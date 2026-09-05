from typing import Annotated
from fastapi import Depends, HTTPException, status, Security, Header
from fastapi.security import SecurityScopes
from core.security import oauth2_scheme, decode_token
from database import SessionDep
from models.user import User
from sqlmodel import select # type: ignore

def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep #type: ignore
) -> User:
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )
    
    payload = decode_token(token)
    if payload.get("type") == "refresh":
        raise HTTPException(401, "Refresh token không được dùng để truy cập API")
    email: str = payload.get("email")
    if email is None:
        raise credentials_exception
    
    token_scopes = payload.get("scopes", [])
    
    user = session.exec(
        select(User).where(User.email == email)
    ).first()
    if user is None:
        raise credentials_exception
        
    allowed_scopes = {"customer"}
    if user.role == "admin":
        allowed_scopes.update({"admin", "manager"})
    elif user.role == "manager":
        allowed_scopes.add("manager")
    for scope in security_scopes.scopes:
        if scope not in allowed_scopes:
            raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này")
        if scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return user


def get_optional_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: SessionDep = None,  # type: ignore
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None

    payload = decode_token(token)
    if payload.get("type") == "refresh":
        raise HTTPException(401, "Refresh token không được dùng để truy cập API")
    email: str = payload.get("email")
    if email is None:
        return None

    user = session.exec(
        select(User).where(User.email == email)
    ).first()
    return user


def require_restaurant_owner(session, restaurant_id: int, user: User):
    from models.restaurant import Restaurant
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(404, "Không tìm thấy nhà hàng")
    if user.role != "admin" and restaurant.manager_id != user.userId:
        raise HTTPException(403, "Bạn không có quyền quản lý nhà hàng này")
    return restaurant
