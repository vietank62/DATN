from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Security
from passlib.context import CryptContext
from database import SessionDep
from models import User
from schemas import UserRegister, UserUpdate
from routers.authentication import get_current_user

router = APIRouter()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


@router.post("/api/create-user/", tags=["User"])
def create_user(user_data: UserRegister, session: SessionDep):
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password=get_password_hash(user_data.password),
        role=user_data.role,
        createdAt=datetime.now().isoformat(timespec="seconds"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get("/api/get-user/{email}", tags=["User"])
def get_user_by_email(email: str, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    user = session.query(User).filter(User.email == email).first()
    return user

@router.get("/api/get-all-user/", tags=["User"])
def get_all_users(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    users = session.query(User).all()
    return users

@router.delete("/api/delete-user/{email}", tags=["User"])
def delete_user_by_email(email: str, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    user = session.query(User).filter(User.email == email).first()
    if user:
        session.delete(user)
        session.commit()
        return {"message": "User deleted successfully"}
    return {"message": "User not found"}

@router.put("/api/update-user/{email}", tags=["User"])
def update_user_by_email(email: str, user_data: UserUpdate, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    user = session.query(User).filter(User.email == email).first()
    if user:
        update_data = user_data.model_dump(exclude_unset=True)
        if "password" in update_data and update_data["password"]:
            update_data["password"] = get_password_hash(update_data["password"])
        for field, value in update_data.items():
            setattr(user, field, value)
        session.commit()
        session.refresh(user)
        return user
    return {"message": "User not found"}


