from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlmodel import select # type: ignore
from database import SessionDep
from models.user import User
from schemas.user import UserOut, UserUpdate, UserRegister, SuspensionUpdate, AppealCreate
from routers.deps import get_current_user, get_current_user_including_suspended
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

@router.post("/me/appeal")
def submit_appeal(payload: AppealCreate, current_user: Annotated[User, Depends(get_current_user_including_suspended)], session: SessionDep):
    if not current_user.isSuspended:
        raise HTTPException(status_code=400, detail="Tài khoản hiện không bị chặn")
    explanation = payload.explanation.strip()
    if len(explanation) < 20:
        raise HTTPException(status_code=400, detail="Giải trình cần có ít nhất 20 ký tự")
    current_user.appealText = explanation
    current_user.appealStatus = "pending"
    session.add(current_user); session.commit()
    return {"message": "Đã gửi giải trình để quản trị viên xem xét"}

@router.put("/{user_id}/suspension", response_model=UserOut)
def update_suspension(user_id: int, payload: SuspensionUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    user = session.get(User, user_id)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.userId == current_user.userId: raise HTTPException(status_code=400, detail="Không thể tự chặn tài khoản quản trị viên hiện tại")
    user.isSuspended = payload.suspended
    user.suspensionReason = payload.reason.strip() if payload.suspended and payload.reason else None
    user.appealStatus = None if not payload.suspended else user.appealStatus
    session.add(user); session.commit(); session.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    raise HTTPException(status_code=405, detail="Không xóa tài khoản. Hãy dùng chức năng tạm chặn và xem xét giải trình.")
