from datetime import timedelta, datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from database import SessionDep
from models.user import User
from schemas.user import UserRegister, UserOut
from schemas.token import Token
from core import security
from core.config import settings
from sqlmodel import select # type: ignore
from routers.deps import get_current_user

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])

def authenticate_user(username: str, password: str, session: SessionDep): #type: ignore
    user = session.exec(select(User).where(User.email == username)).first()
    if not user:
        return False
    if not security.verify_password(password, user.password):
        return False
    return user

@router.post("/register", response_model=UserOut)
def register_user(user_data: UserRegister, session: SessionDep): #type: ignore
    existing_user = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password=security.get_password_hash(user_data.password),
        role="customer",
        createdAt=str(datetime.now(timezone.utc))
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


@router.post("/partner-register", response_model=UserOut)
def register_partner_manager(user_data: UserRegister, session: SessionDep): #type: ignore
    """Đăng ký tài khoản đối tác; role manager không thể tự gán qua đăng ký khách thông thường."""
    if session.exec(select(User).where(User.email == user_data.email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(
        name=user_data.name, email=user_data.email, phone=user_data.phone,
        password=security.get_password_hash(user_data.password), role="manager",
        createdAt=str(datetime.now(timezone.utc)),
    )
    session.add(new_user); session.commit(); session.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep, #type: ignore
    response: Response
):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản hoặc mật khẩu không đúng",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    scopes = ["customer"]
    if user.role == "admin":
        scopes.extend(["admin", "manager"])
    elif user.role == "manager":
        scopes.append("manager")
    
    access_token = security.create_access_token(data={"email": user.email, "scopes": scopes})
    refresh_token = security.create_refresh_token(data={"email": user.email})
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        secure=False,
        samesite="Lax",
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
def refresh_access_token(request: Request, session: SessionDep): #type: ignore
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
        
    payload = security.decode_token(refresh_token)
    email = payload.get("email")
    if email is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    scopes = ["customer"]
    if user.role == "admin":
        scopes.extend(["admin", "manager"])
    elif user.role == "manager":
        scopes.append("manager")

    access_token = security.create_access_token(data={"email": user.email, "scopes": scopes})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Đăng xuất thành công"}

@router.get("/active-user", response_model=UserOut)
def read_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
