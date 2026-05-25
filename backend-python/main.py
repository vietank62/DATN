from fastapi import FastAPI
from database import create_db_and_tables
from routers import user, authentication, restaurant, menuitem, booking, statistical, upload, review, payment
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

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
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user.router)

app.include_router(restaurant.router)

app.include_router(menuitem.router)

app.include_router(authentication.router)

app.include_router(booking.router)

app.include_router(statistical.router)

app.include_router(upload.router)

app.include_router(review.router)

app.include_router(payment.router)


