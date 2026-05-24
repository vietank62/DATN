from typing import Annotated
from fastapi import APIRouter, Depends, Security
from database import SessionDep
from models import MenuItem, User, Restaurant
from schemas import MenuItemUpdate, MenuItemCreate
from routers.authentication import get_current_user
from sqlmodel import select
from sqlalchemy import func

router = APIRouter()

async def update_restaurant_price_range(restaurant_id: int, session: SessionDep):
    # Fetch restaurant
    rest_res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == restaurant_id))
    restaurant = rest_res.scalars().first()
    if not restaurant:
        return
    
    # Query min/max price
    price_res = await session.execute(
        select(
            func.min(MenuItem.price),
            func.max(MenuItem.price)
        ).where(MenuItem.restaurantId == restaurant_id)
    )
    min_price, max_price = price_res.first()
    if min_price is not None and max_price is not None:
        if min_price == max_price:
            restaurant.priceRange = f"{int(min_price):,}đ"
        else:
            restaurant.priceRange = f"{int(min_price):,}đ - {int(max_price):,}đ"
    else:
        restaurant.priceRange = "Chưa cập nhật"
    
    session.add(restaurant)
    await session.commit()

@router.post("/api/create-menuitem/", tags=["MenuItem"])
async def create_menu_item(menu_item_data: MenuItemCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    menu_item = MenuItem(**menu_item_data.model_dump())
    session.add(menu_item)
    await session.commit()
    await session.refresh(menu_item)
    await update_restaurant_price_range(menu_item.restaurantId, session)
    return menu_item

@router.get("/api/get-menuitems-by-restaurant/{restaurant_id}", tags=["MenuItem"])
async def get_menu_items_by_restaurant(restaurant_id: int, session: SessionDep):
    res = await session.execute(select(MenuItem).where(MenuItem.restaurantId == restaurant_id))
    menu_items = res.scalars().all()
    return menu_items

@router.get("/api/get-menuitem/{item_id}", tags=["MenuItem"])
async def get_menu_item_by_id(item_id: int, session: SessionDep):
    res = await session.execute(select(MenuItem).where(MenuItem.itemId == item_id))
    menu_item = res.scalars().first()
    return menu_item

@router.delete("/api/delete-menuitem/{item_id}", tags=["MenuItem"])
async def delete_menu_item_by_id(item_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    res = await session.execute(select(MenuItem).where(MenuItem.itemId == item_id))
    menu_item = res.scalars().first()
    if menu_item:
        restaurant_id = menu_item.restaurantId
        await session.delete(menu_item)
        await session.commit()
        await update_restaurant_price_range(restaurant_id, session)
        return {"message": "Menu item deleted successfully"}
    return {"message": "Menu item not found"}

@router.put("/api/update-menuitem/{item_id}", tags=["MenuItem"])
async def update_menu_item_by_id(item_id: int, updated_menu_item: MenuItemUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    res = await session.execute(select(MenuItem).where(MenuItem.itemId == item_id))
    menu_item = res.scalars().first()
    if menu_item:
        update_data = updated_menu_item.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(menu_item, field, value)
        await session.commit()
        await session.refresh(menu_item)
        await update_restaurant_price_range(menu_item.restaurantId, session)
        return menu_item
    return {"message": "Menu item not found"}