from fastapi import APIRouter
from database import SessionDep
from models import MenuItem
from schemas import MenuItemUpdate, MenuItemCreate


router = APIRouter()

@router.post("/api/create-menuitem/", tags=["MenuItem"])
def create_menu_item(menu_item: MenuItemCreate, session: SessionDep):
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
def delete_menu_item_by_id(item_id: int, session: SessionDep):  
    menu_item = session.query(MenuItem).filter(MenuItem.itemId == item_id).first()
    if menu_item:
        session.delete(menu_item)
        session.commit()
        return {"message": "Menu item deleted successfully"}
    return {"message": "Menu item not found"}

@router.put("/api/update-menuitem/{item_id}", tags=["MenuItem"])
def update_menu_item_by_id(item_id: int, updated_menu_item: MenuItemUpdate, session: SessionDep):
    menu_item = session.query(MenuItem).filter(MenuItem.itemId == item_id).first()
    if menu_item:
        update_data = updated_menu_item.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(menu_item, field, value)
        session.commit()
        session.refresh(menu_item)
        return menu_item
    return {"message": "Menu item not found"}