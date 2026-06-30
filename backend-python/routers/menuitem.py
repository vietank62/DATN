from typing import Annotated
from fastapi import APIRouter, Depends, Security
from database import SessionDep
from models import MenuItem, User, Restaurant
from schemas.reviewMenuSchema import MenuItemCreate, MenuItemUpdate
from routers.authentication import get_current_user
from sqlmodel import select
from sqlalchemy import func

router = APIRouter()


def update_restaurant_price_range(restaurant_id: int, session: SessionDep):
    restaurant = session.exec(select(Restaurant).where(Restaurant.id == restaurant_id)).first()
    if not restaurant:
        return

    price_res = session.exec(
        select(
            func.min(MenuItem.price),
            func.max(MenuItem.price)
        ).where(MenuItem.restaurantId == restaurant_id)
    )
    min_price, max_price = price_res.first()
    if min_price is not None and max_price is not None:
        if min_price == max_price:
            restaurant.price_avg = int(min_price)
        else:
            restaurant.price_avg = int((min_price + max_price) / 2)
    else:
        restaurant.price_avg = 0

    session.add(restaurant)
    session.commit()


@router.post("/api/create-menuitem/", tags=["MenuItem"])
def create_menu_item(
    menu_item_data: MenuItemCreate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    menu_item = MenuItem(**menu_item_data.model_dump())
    session.add(menu_item)
    session.commit()
    session.refresh(menu_item)
    update_restaurant_price_range(menu_item.restaurantId, session)
    return menu_item


@router.get("/api/get-menuitems-by-restaurant/{restaurant_id}", tags=["MenuItem"])
def get_menu_items_by_restaurant(restaurant_id: int, session: SessionDep):
    menu_items = session.exec(select(MenuItem).where(MenuItem.restaurantId == restaurant_id)).all()
    return menu_items


@router.get("/api/get-menuitem/{item_id}", tags=["MenuItem"])
def get_menu_item_by_id(item_id: int, session: SessionDep):
    menu_item = session.exec(select(MenuItem).where(MenuItem.itemId == item_id)).first()
    return menu_item


@router.delete("/api/delete-menuitem/{item_id}", tags=["MenuItem"])
def delete_menu_item_by_id(
    item_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    menu_item = session.exec(select(MenuItem).where(MenuItem.itemId == item_id)).first()
    if menu_item:
        restaurant_id = menu_item.restaurantId
        session.delete(menu_item)
        session.commit()
        update_restaurant_price_range(restaurant_id, session)
        return {"message": "Menu item deleted successfully"}
    return {"message": "Menu item not found"}


@router.put("/api/update-menuitem/{item_id}", tags=["MenuItem"])
def update_menu_item_by_id(
    item_id: int,
    updated_menu_item: MenuItemUpdate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    menu_item = session.exec(select(MenuItem).where(MenuItem.itemId == item_id)).first()
    if menu_item:
        update_data = updated_menu_item.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(menu_item, field, value)
        session.commit()
        session.refresh(menu_item)
        update_restaurant_price_range(menu_item.restaurantId, session)
        return menu_item
    return {"message": "Menu item not found"}