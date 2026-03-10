from fastapi import FastAPI
from database import create_db_and_tables
from routers import user, authentication, restaurant, menuitem, booking, statistical
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.include_router(user.router)

app.include_router(restaurant.router)

app.include_router(menuitem.router)

app.include_router(authentication.router)

app.include_router(booking.router)

app.include_router(statistical.router)