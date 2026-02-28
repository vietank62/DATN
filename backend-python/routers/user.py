from fastapi import APIRouter
from database import SessionDep
from models import User

router = APIRouter()

@router.post("/api/create-user/", tags=["User"])
def create_user(user: User, session: SessionDep):
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get("/api/get-user/{email}", tags=["User"])
def get_user_by_email(email: str, session: SessionDep):
    user = session.query(User).filter(User.email == email).first()
    return user

@router.get("/api/get-all-user/", tags=["User"])
def get_all_users(session: SessionDep):
    users = session.query(User).all()
    return users

@router.delete("/api/delete-user/{email}", tags=["User"])
def delete_user_by_email(email: str, session: SessionDep):
    user = session.query(User).filter(User.email == email).first()
    if user:
        session.delete(user)
        session.commit()
        return {"message": "User deleted successfully"}
    return {"message": "User not found"}

@router.put("/api/update-user/{email}", tags=["User"])
def update_user_by_email(email: str, updated_user: User, session: SessionDep):
    user = session.query(User).filter(User.email == email).first()
    if user:
        user.name = updated_user.name
        user.password = updated_user.password
        session.commit()
        session.refresh(user)
        return user
    return {"message": "User not found"}



