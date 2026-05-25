from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import Response, Request
import os

import jwt
from fastapi import Depends, HTTPException, status, APIRouter, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel, ValidationError
from models import User
from database import SessionDep
from sqlmodel import select
from schemas import UserOut, Token, TokenData, PartnerRegister
from models import Restaurant

router = APIRouter()
# SECRET_KEY loaded from .env – generate with: openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_MINUTES = 30


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/authentication/login",
    scopes={"admin": "Read user information"},
)

def verify_password(plain_password, hashed_password):
    if plain_password == hashed_password:
        return True
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        return False


def authenticate_user(username: str, password: str, session: SessionDep):
    user = session.exec(select(User).where(User.email == username)).first()
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30) 
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/api/authentication/login", tags = ["Authentication"])
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    response: Response
) -> Token:
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scopes = []
    if user.role == "admin":
        scopes.extend(["admin", "manager", "customer"])
    elif user.role == "manager":
        scopes.extend(["manager", "customer"])
    else:
        scopes.append("customer")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"email": user.email, "scopes": scopes}, expires_delta = access_token_expires
    )
    refresh_token = create_refresh_token(
        data={"email": user.email}, expires_delta=refresh_token_expires
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_MINUTES * 60, # 30 minutes
        secure=False,  # Chỉ gửi cookie qua HTTP
        samesite="Lax",  # Ngăn chặn CSRF
    )
    return Token(access_token = access_token, token_type = "bearer")

@router.post("/api/authentication/refresh-token", tags=["Authentication"])
def refresh_access_token(request: Request, session: SessionDep) -> Token:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("email")
        if email is None or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token structure",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.PyJWTError as e:
        print(f"JWT Refresh Error: {str(e)}") # Log for debugging
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired refresh token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"Unexpected Refresh Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh",
        )
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scopes = []
    if user.role == "admin":
        scopes.extend(["admin", "manager", "customer"])
    elif user.role == "manager":
        scopes.extend(["manager", "customer"])
    else:
        scopes.append("customer")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"email": user.email, "scopes": scopes}, expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")

@router.post("/api/authentication/logout", tags=["Authentication"])
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Đăng xuất thành công"}

def get_current_user(security_scopes: SecurityScopes, token: Annotated[str, Depends(oauth2_scheme)], session : SessionDep) -> User:
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("email")
        if email is None:
            raise credentials_exception
        token_scopes = payload.get("scopes", [])
        token_data = TokenData(scopes=token_scopes, username=email)
    except (InvalidTokenError, ValidationError):
        raise credentials_exception
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise credentials_exception
    for scope in security_scopes.scopes:
        if scope not in token_data.scopes:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return user


@router.get("/api/authentication/active-user", response_model = UserOut, tags=["Authentication"])
def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user

@router.post("/api/authentication/register-partner", tags=["Authentication"])
def register_partner(partner_data: PartnerRegister, session: SessionDep):
    # Kiểm tra email tồn tại
    existing_user = session.exec(select(User).where(User.email == partner_data.user.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    
    # Tạo tài khoản manager
    user_db = User(
        name=partner_data.user.name,
        email=partner_data.user.email,
        phone=partner_data.user.phone,
        password=pwd_context.hash(partner_data.user.password),
        role="manager",
        createdAt=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )
    session.add(user_db)
    session.commit()
    session.refresh(user_db)
    
    # Tạo nhà hàng ở trạng thái pending
    # Loại bỏ managerID từ data đầu vào để dùng ID của user vừa tạo
    restaurant_data = partner_data.restaurant.model_dump(exclude={"managerID"})
    restaurant_db = Restaurant(
        **restaurant_data,
        managerID=user_db.userId,
        status="pending"
    )
    session.add(restaurant_db)
    session.commit()
    session.refresh(restaurant_db)
    
    return {"message": "Đăng ký đối tác thành công. Vui lòng chờ Admin phê duyệt.", "restaurantId": restaurant_db.restaurantId}
