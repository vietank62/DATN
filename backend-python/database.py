import os
from dotenv import load_dotenv
from typing import Annotated
from fastapi.params import Depends
from sqlmodel import SQLModel, Session, create_engine # type: ignore
from sqlalchemy.orm import declarative_base # type: ignore
import redis.asyncio as aioredis # type: ignore

load_dotenv()

URL_DATABASE = os.getenv("URL_DATABASE")

engine = create_engine(URL_DATABASE)

redis_client = aioredis.from_url(
    os.getenv("REDIS_URL"),
    decode_responses=True,
    encoding="utf-8",
    max_connections=10,
    socket_connect_timeout=5,
    socket_keepalive=True,
    socket_keepalive_options={
        "TCP_KEEPIDLE": 60, 
        "TCP_KEEPINTVL": 10, 
        "TCP_KEEPCNT": 5
    },
    retry_on_timeout=True,
    health_check_interval=30,
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    Base.metadata.create_all(engine)
    
def get_session():
    with Session(engine) as session:
        yield session
        
async def get_redis_client():
    yield redis_client

SessionDep = Annotated[Session, Depends(get_session)]

Base = declarative_base()