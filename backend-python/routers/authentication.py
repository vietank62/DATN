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

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 5
REFRESH_TOKEN_EXPIRE_MINUTES = 10


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/v1/auth/login",
    scopes={"admin": "Admin rights", "manager": "Manager rights", "customer": "Customer rights"},
)

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        return False

def authenticate_user(username: str, password: str, session: SessionDep):
    user = session.exec(
        select(User.userId, User.password, User.role, User.email)
        .where(User.email == username)
    ).first()
    
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/v1/auth/login", tags=["Authentication"])
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
    
    scopes = ["customer"]
    if user.role == "admin":
        scopes.extend(["admin", "manager"])
    elif user.role == "manager":
        scopes.append("manager")
    
    access_token = create_access_token(
        data={"email": user.email, "scopes": scopes}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(
        data={"email": user.email}, 
        expires_delta=timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        secure=False, 
        samesite="Lax",
    )
    return Token(access_token=access_token, token_type="bearer")

@router.post("/v1/auth/refresh", tags=["Authentication"])
def refresh_access_token(request: Request, session: SessionDep) -> Token:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
        
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("email")
        if email is None or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Expired or invalid refresh token")

    user = session.exec(select(User.email, User.role).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    scopes = ["customer"]
    if user.role == "admin":
        scopes.extend(["admin", "manager"])
    elif user.role == "manager":
        scopes.append("manager")

    access_token = create_access_token(
        data={"email": user.email, "scopes": scopes}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer")

@router.post("/v1/auth/logout", tags=["Authentication"])
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Đăng xuất thành công"}

def get_current_user(security_scopes: SecurityScopes, token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> User:
    authenticate_value = f'Bearer scope="{security_scopes.scope_str}"' if security_scopes.scopes else "Bearer"
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
    except (jwt.PyJWTError, ValidationError):
        raise credentials_exception
        
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise credentials_exception
        
    for scope in security_scopes.scopes:
        if scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return user

@router.get("/v1/auth/active-user", response_model=UserOut, tags=["Authentication"])
def read_users(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
