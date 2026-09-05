import os
from dotenv import load_dotenv
from typing import Annotated
from fastapi.params import Depends
from sqlmodel import SQLModel, Session, create_engine # type: ignore
from sqlalchemy.orm import declarative_base # type: ignore
from upstash_redis.asyncio import Redis

load_dotenv()

URL_DATABASE = os.getenv("URL_DATABASE")

engine = create_engine(URL_DATABASE)

redis_client = Redis.from_env()

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
