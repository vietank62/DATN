from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Security
from database import SessionDep
from models import Branch, Restaurant, User
from schemas import BranchCreate, BranchUpdate
from routers.authentication import get_current_user

router = APIRouter()

@router.post("/api/branches/", tags=["Branch"])
def create_branch(
    branch_data: BranchCreate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    # Kiểm tra nhà hàng tồn tại
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == branch_data.restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    branch = Branch(**branch_data.model_dump())
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch

@router.get("/api/branches/restaurant/{restaurant_id}", tags=["Branch"])
def get_branches_by_restaurant(restaurant_id: int, session: SessionDep):
    branches = session.query(Branch).filter(Branch.restaurantId == restaurant_id).all()
    return branches

@router.get("/api/branches/{branch_id}", tags=["Branch"])
def get_branch_by_id(branch_id: int, session: SessionDep):
    branch = session.query(Branch).filter(Branch.branchId == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch

@router.put("/api/branches/{branch_id}", tags=["Branch"])
def update_branch(
    branch_id: int,
    updated_branch: BranchUpdate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    branch = session.query(Branch).filter(Branch.branchId == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    update_data = updated_branch.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branch, field, value)
    session.commit()
    session.refresh(branch)
    return branch

@router.delete("/api/branches/{branch_id}", tags=["Branch"])
def delete_branch(
    branch_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    branch = session.query(Branch).filter(Branch.branchId == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    session.delete(branch)
    session.commit()
    return {"message": "Branch deleted successfully"}
