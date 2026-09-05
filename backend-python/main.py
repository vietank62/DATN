import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request, Header, HTTPException
from typing import Annotated
import hmac
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, TimeoutError as SQLAlchemyTimeoutError
from starlette.concurrency import run_in_threadpool
from sqlmodel import Session  # type: ignore
from database import create_db_and_tables, engine, SessionDep
from core.deposit_expiry import expire_unpaid_bookings
from core.deposit_checkout import maintain_checkout_sessions
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
    partner,
    notification,
    violationReport,
    chat,
    favorite,
    assistant,
    deposits,
)

# Upstash uses httpx internally. Keep successful cache traffic out of the
# terminal so API request lines remain easy to see.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def warm_database_connection() -> None:
    """Warm one connection without delaying application startup."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        print("[DATABASE] Connection warm-up skipped; the next request will retry.", flush=True)
    else:
        print("[DATABASE] Connection pool warmed.", flush=True)


def run_booking_maintenance() -> tuple[int, int, int]:
    """Run synchronous database maintenance outside FastAPI's event loop."""
    with Session(engine) as session:
        return (
            expire_unpaid_bookings(session),
            booking.auto_complete_expired_confirmed_bookings(session),
            booking.expire_unanswered_bookings(session),
        )


async def booking_completion_worker() -> None:
    # Recover overdue deposits shortly after startup.
    await asyncio.sleep(5)

    while True:
        try:
            deposit_expired_count, completed_count, expired_count = await run_in_threadpool(
                run_booking_maintenance
            )

            if deposit_expired_count:
                print(f"Expired {deposit_expired_count} unpaid booking(s).")
            if completed_count:
                print(f"Auto-completed {completed_count} expired confirmed booking(s).")
            if expired_count:
                print(f"Expired {expired_count} unanswered booking(s).")
        except Exception as error:
            print(
                f"[BOOKING-WORKER] Maintenance skipped: {type(error).__name__}",
                flush=True,
            )

        await asyncio.sleep(60)


def run_checkout_maintenance():
    with Session(engine) as session:
        maintain_checkout_sessions(session)


async def checkout_expiry_worker():
    while True:
        try:
            await run_in_threadpool(run_checkout_maintenance)
        except Exception as error:
            logging.getLogger(__name__).warning("Checkout maintenance failed: %s", type(error).__name__)
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if create_db_and_tables():
        print("[STARTUP] Created database tables for a fresh local environment.", flush=True)
    else:
        print("[STARTUP] Schema changes are managed by Alembic migrations.", flush=True)

    # Serverless instances may stop after a request; never depend on infinite tasks there.
    workers_enabled = os.getenv("ENABLE_BACKGROUND_WORKERS", "false" if os.getenv("VERCEL") == "1" else "true").lower() == "true"
    tasks = []
    if workers_enabled:
        tasks = [asyncio.create_task(run_in_threadpool(warm_database_connection)),
                 asyncio.create_task(booking_completion_worker()),
                 asyncio.create_task(checkout_expiry_worker())]
    try:
        if MCP_AVAILABLE:
            async with table_now_mcp.session_manager.run():
                yield
        else:
            yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(lifespan=lifespan, title="DATN API")


async def database_unavailable_response(request: Request) -> JSONResponse:
    print(
        f"[DATABASE] {request.method} {request.url.path} -> 503 (connection unavailable)",
        flush=True,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is temporarily unavailable. Please try again shortly."},
    )


@app.exception_handler(OperationalError)
async def handle_database_operational_error(
    request: Request,
    _error: OperationalError,
) -> JSONResponse:
    return await database_unavailable_response(request)


@app.exception_handler(SQLAlchemyTimeoutError)
async def handle_database_timeout(
    request: Request,
    _error: SQLAlchemyTimeoutError,
) -> JSONResponse:
    return await database_unavailable_response(request)


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

frontend_origin = os.getenv("FRONTEND_URL", "").rstrip("/")
if frontend_origin and frontend_origin not in origins:
    origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if MCP_AVAILABLE and mcp_asgi_app is not None:
    app.mount("/mcp", mcp_asgi_app)



@app.middleware("http")
async def request_timing_log(request, call_next):
    """Emit safe request timing logs without logging tokens or request bodies."""
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(
            f"[API] {request.method} {request.url.path} -> 500 in {duration_ms:.1f}ms (unhandled error)",
            flush=True,
        )
        raise

    duration_ms = (time.perf_counter() - started_at) * 1000
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
    level = "SLOW" if duration_ms >= 1000 else "API"
    print(
        f"[{level}] {request.method} {request.url.path} -> {response.status_code} in {duration_ms:.1f}ms",
        flush=True,
    )
    return response


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}

app.include_router(authentication.router)
app.include_router(user.router)
app.include_router(restaurant.router)
app.include_router(menuitem.router)
app.include_router(booking.router)
app.include_router(statistical.router)
app.include_router(upload.router)
app.include_router(review.router)
app.include_router(partner.router)
app.include_router(notification.router)
app.include_router(violationReport.router)
app.include_router(chat.router)
app.include_router(detail.router)
app.include_router(favorite.router)
app.include_router(assistant.router)
app.include_router(deposits.router)


@app.get("/internal/maintenance", tags=["System"])
def scheduled_maintenance(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
):
    secret = os.getenv("CRON_SECRET", "")
    if not secret:
        raise HTTPException(503, "Maintenance authentication is not configured")
    if not hmac.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode()):
        raise HTTPException(401, "Unauthorized maintenance request")
    expired = expire_unpaid_bookings(session, limit=20)
    result = maintain_checkout_sessions(session)
    completed = booking.auto_complete_expired_confirmed_bookings(session, limit=20)
    unanswered = booking.expire_unanswered_bookings(session, limit=20)
    return {"expiredBookings": expired, "completedBookings": completed, "unansweredBookings": unanswered, **result}
