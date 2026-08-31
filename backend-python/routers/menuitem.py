from fastapi import APIRouter, Depends, HTTPException
from database import SessionDep
from models.menuItem import RestaurantMenuList
from models.restaurant import Restaurant
from sqlmodel import select  # type: ignore
from schemas.menuItems import MenuItemBase , MenuItemCreate

router = APIRouter(prefix="/v1/menuitems", tags=["MenuItem"])


@router.get("/restaurant/{restaurant_id}", response_model=list[MenuItemBase])
def get_menu_items_by_restaurant(restaurant_id: int, session: SessionDep):  # type: ignore
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    statement = (
        select(RestaurantMenuList)
        .where(RestaurantMenuList.restaurant_id == restaurant_id)
        .order_by(RestaurantMenuList.category.asc(), RestaurantMenuList.name.asc(), RestaurantMenuList.id.asc())
    )
    return session.exec(statement).all()

@router.post("/restaurant/{restaurant_id}", response_model=MenuItemBase)
def create_menu_item(restaurant_id: int, menu_item: MenuItemCreate, session: SessionDep):  # type: ignore
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    db_menu_item = RestaurantMenuList(**menu_item.model_dump(), restaurant_id=restaurant_id)

    session.add(db_menu_item)
    session.commit()

    session.refresh(db_menu_item)

    return db_menu_item

@router.put("/restaurant/{restaurant_id}/menuitem/{menuitem_id}/availability", response_model=RestaurantMenuList)
def update_menu_item_availability(restaurant_id: int, menuitem_id: int, session: SessionDep):  # type: ignore
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    menu_item = session.get(RestaurantMenuList, menuitem_id)
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    menu_item.is_available = not menu_item.is_available
    session.add(menu_item)
    session.commit()
    session.refresh(menu_item)

    return menu_item

@router.put("/restaurant/{restaurant_id}/{menuitem_id}", response_model=RestaurantMenuList)
def update_menu_item(restaurant_id: int, menuitem_id: int, menu_item: MenuItemCreate, session: SessionDep):
    item = session.get(RestaurantMenuList, menuitem_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    for key, value in menu_item.model_dump().items(): setattr(item, key, value)
    session.add(item); session.commit(); session.refresh(item)
    return item

@router.delete("/restaurant/{restaurant_id}/{menuitem_id}")
def delete_menu_item(restaurant_id: int, menuitem_id: int, session: SessionDep):
    item = session.get(RestaurantMenuList, menuitem_id)
    if not item or item.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    session.delete(item); session.commit()
    return {"message": "Menu item deleted"}
