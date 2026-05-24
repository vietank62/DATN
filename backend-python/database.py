import os
import ssl
import urllib.parse as urlparse
from typing import Annotated
from dotenv import load_dotenv
from fastapi.params import Depends
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

URL_DATABASE = os.getenv("URL_DATABASE", "")
engine_args = {"echo": True}

if URL_DATABASE.startswith("postgresql://"):
    # Chuyển postgresql:// thành postgresql+asyncpg://
    URL_DATABASE = URL_DATABASE.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    # Bóc tách sslmode của psycopg2 để cấu hình tương thích cho asyncpg (Bỏ qua lỗi SSL tự ký của Cloud DB)
    if "sslmode=" in URL_DATABASE:
        url_parts = list(urlparse.urlparse(URL_DATABASE))
        query = dict(urlparse.parse_qsl(url_parts[4]))
        sslmode = query.pop("sslmode", None)
        url_parts[4] = urlparse.urlencode(query)
        URL_DATABASE = urlparse.urlunparse(url_parts)
        
        if sslmode in ["require", "prefer", "allow"]:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            engine_args["connect_args"] = {"ssl": ssl_context}

elif URL_DATABASE.startswith("sqlite://"):
    # Chuyển sqlite:// thành sqlite+aiosqlite://
    URL_DATABASE = URL_DATABASE.replace("sqlite://", "sqlite+aiosqlite://", 1)
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(URL_DATABASE, **engine_args)

async def create_db_and_tables():
    """Khởi tạo toàn bộ cấu trúc bảng cơ sở dữ liệu"""
    import models
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
async def get_session():
    """Cung cấp Database Session cho mỗi API request"""
    async with AsyncSession(engine) as session:
        yield session

# Dependency dùng chung cho các API Router
SessionDep = Annotated[AsyncSession, Depends(get_session)]