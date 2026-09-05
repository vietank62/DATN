from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Security
from sqlalchemy import func, tuple_, update
from sqlmodel import select  # type: ignore

from database import SessionDep
from models.booking import Booking
from models.chatMessage import ChatMessage
from models.conversation import Conversation
from models.notification import Notification
from models.restaurant import Restaurant
from models.user import User
from routers.deps import get_current_user
from schemas.chat import ConversationCreate, MessageCreate


router = APIRouter(prefix="/v1/chat", tags=["Chat"])


def get_manager_restaurant(session: SessionDep, manager_id: int) -> Restaurant:
    restaurant = session.exec(
        select(Restaurant).where(Restaurant.manager_id == manager_id)
    ).first()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found for this manager")

    return restaurant


def get_conversation_or_404(session: SessionDep, conversation_id: int) -> Conversation:
    conversation = session.get(Conversation, conversation_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation


def ensure_conversation_access(
    session: SessionDep,
    conversation: Conversation,
    current_user: User,
) -> Restaurant:
    if current_user.role == "customer" and conversation.customer_id == current_user.userId:
        restaurant = session.get(Restaurant, conversation.restaurant_id)
        if restaurant:
            return restaurant

    if current_user.role == "manager":
        restaurant = get_manager_restaurant(session, current_user.userId)
        if restaurant.id == conversation.restaurant_id:
            return restaurant

    raise HTTPException(status_code=403, detail="You do not have access to this conversation")


def serialize_conversations(
    session: SessionDep,
    conversations: list[Conversation],
    current_user: User,
) -> list[dict]:
    """Serialize a conversation list with fixed query count instead of N+1 queries."""
    if not conversations:
        return []

    conversation_ids = [conversation.id for conversation in conversations if conversation.id]
    restaurant_ids = {conversation.restaurant_id for conversation in conversations}
    customer_ids = {conversation.customer_id for conversation in conversations}
    conversation_pairs = [
        (conversation.customer_id, conversation.restaurant_id)
        for conversation in conversations
    ]

    restaurants_by_id = {
        restaurant.id: restaurant
        for restaurant in session.exec(
            select(Restaurant).where(Restaurant.id.in_(restaurant_ids))
        ).all()
    }
    customers_by_id = {
        customer.userId: customer
        for customer in session.exec(
            select(User).where(User.userId.in_(customer_ids))
        ).all()
    }

    unread_rows = session.exec(
        select(
            ChatMessage.conversation_id,
            func.count(ChatMessage.id),
        )
        .where(
            ChatMessage.conversation_id.in_(conversation_ids),
            ChatMessage.sender_id != current_user.userId,
            ChatMessage.is_read == False,
        )
        .group_by(ChatMessage.conversation_id)
    ).all()
    unread_by_conversation_id = {
        conversation_id: count
        for conversation_id, count in unread_rows
    }

    latest_messages = (
        select(
            ChatMessage.conversation_id.label("conversation_id"),
            ChatMessage.content.label("content"),
            func.row_number()
            .over(
                partition_by=ChatMessage.conversation_id,
                order_by=ChatMessage.created_at.desc(),
            )
            .label("position"),
        )
        .where(ChatMessage.conversation_id.in_(conversation_ids))
        .subquery()
    )
    latest_message_rows = session.execute(
        select(
            latest_messages.c.conversation_id,
            latest_messages.c.content,
        ).where(latest_messages.c.position == 1)
    ).all()
    last_message_by_conversation_id = {
        conversation_id: content
        for conversation_id, content in latest_message_rows
    }

    ranked_bookings = (
        select(
            Booking.userId.label("customer_id"),
            Booking.restaurantId.label("restaurant_id"),
            Booking.bookingId.label("booking_id"),
            Booking.date.label("date"),
            Booking.time.label("time"),
            Booking.status.label("status"),
            func.row_number()
            .over(
                partition_by=(Booking.userId, Booking.restaurantId),
                order_by=Booking.bookingId.desc(),
            )
            .label("position"),
        )
        .where(
            tuple_(Booking.userId, Booking.restaurantId).in_(conversation_pairs)
        )
        .subquery()
    )
    booking_rows = session.execute(
        select(
            ranked_bookings.c.customer_id,
            ranked_bookings.c.restaurant_id,
            ranked_bookings.c.booking_id,
            ranked_bookings.c.date,
            ranked_bookings.c.time,
            ranked_bookings.c.status,
        )
        .where(ranked_bookings.c.position <= 5)
        .order_by(
            ranked_bookings.c.customer_id,
            ranked_bookings.c.restaurant_id,
            ranked_bookings.c.booking_id.desc(),
        )
    ).all()
    bookings_by_conversation_pair: dict[tuple[int, int], list[dict]] = {}
    for customer_id, restaurant_id, booking_id, date, time, status in booking_rows:
        bookings_by_conversation_pair.setdefault(
            (customer_id, restaurant_id),
            [],
        ).append(
            {
                "bookingId": booking_id,
                "date": date,
                "time": time,
                "status": status,
            }
        )

    result: list[dict] = []
    for conversation in conversations:
        restaurant = restaurants_by_id.get(conversation.restaurant_id)
        customer = customers_by_id.get(conversation.customer_id)
        result.append(
            {
                "id": conversation.id,
                "restaurant": {
                    "id": restaurant.id,
                    "name": restaurant.name,
                    "image_url": restaurant.image_url,
                }
                if restaurant
                else None,
                "customer": {
                    "id": customer.userId,
                    "name": customer.name,
                    "avatar": customer.avatar,
                }
                if customer
                else None,
                "last_message": last_message_by_conversation_id.get(conversation.id),
                "last_message_at": conversation.last_message_at,
                "unread_count": unread_by_conversation_id.get(conversation.id, 0),
                "related_bookings": bookings_by_conversation_pair.get(
                    (conversation.customer_id, conversation.restaurant_id),
                    [],
                ),
            }
        )

    return result

@router.post("/conversations", response_model=dict)
def create_or_get_conversation(
    data: ConversationCreate,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
    session: SessionDep,
):
    restaurant = session.get(Restaurant, data.restaurant_id)

    if not restaurant or not restaurant.is_active:
        raise HTTPException(status_code=404, detail="Restaurant is not available")

    conversation = session.exec(
        select(Conversation).where(
            Conversation.customer_id == current_user.userId,
            Conversation.restaurant_id == data.restaurant_id,
        )
    ).first()

    if not conversation:
        conversation = Conversation(
            customer_id=current_user.userId,
            restaurant_id=data.restaurant_id,
        )
        session.add(conversation)
        session.flush()
        conversation_id = conversation.id
        last_message_at = conversation.last_message_at
        session.commit()
    else:
        conversation_id = conversation.id
        last_message_at = conversation.last_message_at

    # Return the minimum payload needed to open the chat immediately.
    # The conversation list fetches unread counts and related bookings in parallel.
    return {
        "id": conversation_id,
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "image_url": restaurant.image_url,
        },
        "customer": {
            "id": current_user.userId,
            "name": current_user.name,
            "avatar": current_user.avatar,
        },
        "last_message": None,
        "last_message_at": last_message_at,
        "unread_count": 0,
        "related_bookings": [],
    }


@router.get("/conversations/me", response_model=list[dict])
def get_my_conversations(
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
):
    if current_user.role == "customer":
        statement = select(Conversation).where(Conversation.customer_id == current_user.userId)
    elif current_user.role == "manager":
        restaurant = get_manager_restaurant(session, current_user.userId)
        statement = select(Conversation).where(Conversation.restaurant_id == restaurant.id)
    else:
        raise HTTPException(status_code=403, detail="Chat is only available to customers and managers")

    conversations = session.exec(
        statement.order_by(Conversation.last_message_at.desc())
    ).all()
    return serialize_conversations(session, conversations, current_user)


@router.get("/conversations/{conversation_id}/messages", response_model=list[dict])
def get_messages(
    conversation_id: int,
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    conversation = get_conversation_or_404(session, conversation_id)
    ensure_conversation_access(session, conversation, current_user)
    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    ).all()
    sender_ids = [message.sender_id for message in messages]
    senders = session.exec(select(User).where(User.userId.in_(sender_ids))).all() if sender_ids else []
    senders_by_id = {sender.userId: sender for sender in senders}

    return [
        {
            "id": message.id,
            "sender_id": message.sender_id,
            "sender_name": senders_by_id.get(message.sender_id).name if message.sender_id in senders_by_id else "Người dùng",
            "content": message.content,
            "is_read": message.is_read,
            "created_at": message.created_at,
        }
        for message in messages
    ]


@router.post("/conversations/{conversation_id}/messages", response_model=dict)
def send_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
):
    conversation = get_conversation_or_404(session, conversation_id)
    restaurant = ensure_conversation_access(session, conversation, current_user)
    content = data.content.strip()
    now = datetime.now(timezone.utc)
    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=current_user.userId,
        content=content,
        created_at=now,
    )
    conversation.last_message_at = now
    session.add(message)
    session.add(conversation)
    create_chat_notification(session, conversation, restaurant, current_user, content)
    session.commit()
    session.refresh(message)

    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "sender_name": current_user.name,
        "content": message.content,
        "is_read": message.is_read,
        "created_at": message.created_at,
    }


@router.put("/conversations/{conversation_id}/read", response_model=dict)
def mark_messages_read(
    conversation_id: int,
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
):
    conversation = get_conversation_or_404(session, conversation_id)
    ensure_conversation_access(session, conversation, current_user)
    updated_messages = session.execute(
        update(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.sender_id != current_user.userId,
            ChatMessage.is_read == False,
        )
        .values(is_read=True)
    )
    updated_notifications = session.execute(
        update(Notification)
        .where(
            Notification.userId == current_user.userId,
            Notification.conversationId == conversation_id,
            Notification.type == "chat_message",
            Notification.isRead == False,
        )
        .values(isRead=True)
    )
    session.commit()

    return {
        "updated": updated_messages.rowcount or 0,
        "notifications_updated": updated_notifications.rowcount or 0,
    }
