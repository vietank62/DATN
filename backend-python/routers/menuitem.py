from typing import Annotated
from fastapi import APIRouter, Depends, Security
from database import SessionDep
from models import MenuItem, User
from schemas import MenuItemUpdate, MenuItemCreate
from routers.authentication import get_current_user


router = APIRouter()

@router.post("/api/create-menuitem/", tags=["MenuItem"])
def create_menu_item(menu_item_data: MenuItemCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    menu_item = MenuItem(**menu_item_data.model_dump())
    session.add(menu_item)
    session.commit()
    session.refresh(menu_item)
    return menu_item

@router.get("/api/get-menuitems-by-restaurant/{restaurant_id}", tags=["MenuItem"])
def get_menu_items_by_restaurant(restaurant_id: int, session: SessionDep):
    menu_items = session.query(MenuItem).filter(MenuItem.restaurantId == restaurant_id).all()
    return menu_items

@router.get("/api/get-menuitem/{item_id}", tags=["MenuItem"])
def get_menu_item_by_id(item_id: int, session: SessionDep):
    menu_item = session.query(MenuItem).filter(MenuItem.itemId == item_id).first()
    return menu_item

@router.delete("/api/delete-menuitem/{item_id}", tags=["MenuItem"])
def delete_menu_item_by_id(item_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    menu_item = session.query(MenuItem).filter(MenuItem.itemId == item_id).first()
    if menu_item:
        session.delete(menu_item)
        session.commit()
        return {"message": "Menu item deleted successfully"}
    return {"message": "Menu item not found"}

@router.put("/api/update-menuitem/{item_id}", tags=["MenuItem"])
def update_menu_item_by_id(item_id: int, updated_menu_item: MenuItemUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    menu_item = session.query(MenuItem).filter(MenuItem.itemId == item_id).first()
    if menu_item:
        update_data = updated_menu_item.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(menu_item, field, value)
        session.commit()
        session.refresh(menu_item)
        return menu_item
    return {"message": "Menu item not found"}