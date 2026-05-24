from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Security
from database import SessionDep
from models import Branch, Restaurant, User
from schemas import BranchCreate, BranchUpdate
from routers.authentication import get_current_user
from sqlmodel import select

router = APIRouter()

@router.post("/api/branches/", tags=["Branch"])
async def create_branch(
    branch_data: BranchCreate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    # Kiểm tra nhà hàng tồn tại
    rest_res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == branch_data.restaurantId))
    restaurant = rest_res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    branch = Branch(**branch_data.model_dump())
    session.add(branch)
    await session.commit()
    await session.refresh(branch)
    return branch

@router.get("/api/branches/restaurant/{restaurant_id}", tags=["Branch"])
async def get_branches_by_restaurant(restaurant_id: int, session: SessionDep):
    res = await session.execute(select(Branch).where(Branch.restaurantId == restaurant_id))
    branches = res.scalars().all()
    return branches

@router.get("/api/branches/{branch_id}", tags=["Branch"])
async def get_branch_by_id(branch_id: int, session: SessionDep):
    res = await session.execute(select(Branch).where(Branch.branchId == branch_id))
    branch = res.scalars().first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch

@router.put("/api/branches/{branch_id}", tags=["Branch"])
async def update_branch(
    branch_id: int,
    updated_branch: BranchUpdate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    res = await session.execute(select(Branch).where(Branch.branchId == branch_id))
    branch = res.scalars().first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    update_data = updated_branch.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branch, field, value)
    await session.commit()
    await session.refresh(branch)
    return branch

@router.delete("/api/branches/{branch_id}", tags=["Branch"])
async def delete_branch(
    branch_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    res = await session.execute(select(Branch).where(Branch.branchId == branch_id))
    branch = res.scalars().first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    await session.delete(branch)
    await session.commit()
    return {"message": "Branch deleted successfully"}
