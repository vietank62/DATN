import os
from dotenv import load_dotenv
from typing import Annotated
from fastapi.params import Depends
from sqlmodel import SQLModel, Session, create_engine # type: ignore
from sqlalchemy.orm import declarative_base # type: ignore
from upstash_redis.asyncio import Redis

load_dotenv()

URL_DATABASE = os.getenv("URL_DATABASE")

engine = create_engine(
    URL_DATABASE,
    pool_pre_ping=os.getenv("DB_POOL_PRE_PING", "true" if os.getenv("VERCEL") == "1" else "false").lower() == "true",
    pool_size=int(os.getenv("DB_POOL_SIZE", "2" if os.getenv("VERCEL") == "1" else "4")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "1" if os.getenv("VERCEL") == "1" else "2")),
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800")),
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT_SECONDS", "5")),
    pool_use_lifo=True,
    connect_args={"connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "5"))},
)

Base = declarative_base()
redis_client = Redis.from_env()

_AUTO_CREATE_TRUE_VALUES = {"1", "true", "yes", "on"}


def create_db_and_tables() -> bool:
    """Create tables only when explicitly enabled for a fresh local database.

    Production and shared environments use Alembic migrations. Avoiding schema
    inspection on every boot keeps the API available even while the database is
    temporarily unreachable.
    """
    should_create_tables = (
        os.getenv("AUTO_CREATE_TABLES", "false").strip().lower()
        in _AUTO_CREATE_TRUE_VALUES
    )
    if not should_create_tables:
        return False

    SQLModel.metadata.create_all(engine)
    Base.metadata.create_all(engine)
    return True


def get_session():
    with Session(engine) as session:
        yield session


async def get_redis_client():
    yield redis_client


SessionDep = Annotated[Session, Depends(get_session)]
