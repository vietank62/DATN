from fastapi import APIRouter, HTTPException, Security
from typing import Annotated
from models.user import User
from routers.deps import get_current_user, require_restaurant_owner
from database import SessionDep
from sqlmodel import select  # type: ignore
from models.resDetail import RestaurantDetail
from schemas.resDetail import RestaurantDetailCreate

router = APIRouter(prefix="/v1/details", tags=["RestaurantDetails"])


@router.get("/{restaurant_id}")
def get_restaurant_detail(restaurant_id: int, session: SessionDep):  # type: ignore
    detail = session.exec(
        select(RestaurantDetail).where(RestaurantDetail.restaurant_id == restaurant_id)
    ).first()

    if not detail:
        raise HTTPException(status_code=404, detail="Restaurant detail not found")

    return detail


@router.post("/", response_model=RestaurantDetail)
def create_restaurant_detail(detail: RestaurantDetailCreate, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
):  # type: ignore
    require_restaurant_owner(session, detail.restaurant_id, current_user)
    db_detail = RestaurantDetail(**detail.model_dump())
    session.add(db_detail)
    session.commit()
    session.refresh(db_detail)
    return db_detail