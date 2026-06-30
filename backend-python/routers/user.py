from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlmodel import select # type: ignore
from database import SessionDep
from models.user import User
from schemas.userSchema import UserOut, UserUpdate, UserRegister
from routers.deps import get_current_user
from core import security
from datetime import datetime, timezone

router = APIRouter(prefix="/v1/users", tags=["User"])

@router.get("/me", response_model=UserOut)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    """Lấy thông tin cá nhân của user đang đăng nhập."""
    return current_user

@router.put("/me", response_model=UserOut)
def update_me(
    user_data: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDep #type: ignore
):
    """Cập nhật thông tin cá nhân."""
    update_data = user_data.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["password"] = security.get_password_hash(update_data["password"])
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

# --- ADMIN ROUTES ---

@router.get("/", response_model=List[UserOut])
def get_all_users(
    session: SessionDep, #type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]
):
    users = session.exec(select(User)).all()
    return users

@router.post("/", response_model=User)
def admin_create_user(
    user_data: UserRegister,
    session: SessionDep, #type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]
):
    existing_user = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password=security.get_password_hash(user_data.password),
        role=user_data.role,
        createdAt=str(datetime.now(timezone.utc))
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    session: SessionDep, #type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]
):
    """Admin xóa người dùng theo ID."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully"}
