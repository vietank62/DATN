from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Security
from sqlmodel import select # type: ignore
from sqlalchemy import func, or_  # type: ignore
from database import SessionDep
from models.user import User
from schemas.user import UserOut, UserUpdate, UserRegister
from routers.deps import get_current_user
from core import security
from datetime import datetime, timezone

router = APIRouter(prefix="/v1/users", tags=["User"])


def _apply_user_update_fields(user: User, update_data: dict):
    """Cập nhật từng field được gửi lên, không ảnh hưởng đến các field còn lại."""
    for field, value in update_data.items():
        if field == "password":
            # Không bao giờ ghi mật khẩu thô hoặc ghi đè hash hiện có bằng chuỗi rỗng.
            if value is None or not value.strip():
                continue
            value = security.get_password_hash(value)
        setattr(user, field, value)


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
    """Cập nhật thông tin cá nhân theo từng field được gửi lên."""
    update_data = user_data.model_dump(exclude_unset=True)
    _apply_user_update_fields(current_user, update_data)

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

# --- ADMIN ROUTES ---

@router.get("/", response_model=dict)
def get_all_users(
    session: SessionDep, #type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=100),
):
    statement = select(User)
    count_statement = select(func.count(User.userId))

    if search and search.strip():
        keyword = f"%{search.strip()}%"
        filters = or_(
            User.name.ilike(keyword),
            User.email.ilike(keyword),
            User.phone.ilike(keyword),
        )
        statement = statement.where(filters)
        count_statement = count_statement.where(filters)

    total = session.exec(count_statement).one()
    users = session.exec(
        statement
        .order_by(User.userId.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "items": users,
        "total": total,
        "limit": limit,
        "offset": offset,
    }

@router.post("/", response_model=UserOut)
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

@router.put("/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: int,
    user_data: UserUpdate,
    session: SessionDep, #type: ignore
    # current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    """Admin cập nhật thông tin người dùng theo ID từng field."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    _apply_user_update_fields(user, update_data)

    session.add(user)
    session.commit()
    session.refresh(user)
    return user

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
