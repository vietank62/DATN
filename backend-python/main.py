import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session  # type: ignore

from database import create_db_and_tables, engine
from mcp_server import MCP_AVAILABLE, mcp_asgi_app, table_now_mcp
from routers import (
    user, 
    authentication, 
    restaurant, 
    detail,
    menuitem, 
    booking, 
    statistical, 
    upload, 
    review, 
    payment, 
    partner,
    notification,
    violationReport,
    chat,
    favorite,
    assistant,
)

async def booking_completion_worker() -> None:
    while True:
        try:
            with Session(engine) as session:
                completed_count = booking.auto_complete_expired_confirmed_bookings(session)

                if completed_count:
                    print(f"Auto-completed {completed_count} expired confirmed booking(s).")
        except Exception as error:
            print(f"Booking auto-completion error: {error}")

        await asyncio.sleep(60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    booking_completion_task = asyncio.create_task(booking_completion_worker())

    try:
        if MCP_AVAILABLE:
            async with table_now_mcp.session_manager.run():
                yield
        else:
            yield
    finally:
        booking_completion_task.cancel()
        with suppress(asyncio.CancelledError):
            await booking_completion_task

app = FastAPI(lifespan=lifespan, title="DATN API")

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173",
    "https://datn-red.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if MCP_AVAILABLE and mcp_asgi_app is not None:
    app.mount("/mcp", mcp_asgi_app)

app.include_router(authentication.router)
app.include_router(user.router)
app.include_router(restaurant.router)
app.include_router(menuitem.router)
app.include_router(booking.router)
app.include_router(statistical.router)
app.include_router(upload.router)
app.include_router(review.router)
app.include_router(payment.router)
app.include_router(partner.router)
app.include_router(notification.router)
app.include_router(violationReport.router)
app.include_router(chat.router)
app.include_router(detail.router)
app.include_router(favorite.router)
app.include_router(assistant.router)
