import os
from typing import Annotated
from dotenv import load_dotenv
from fastapi.params import Depends
from sqlmodel import SQLModel, Session, create_engine

dotenv_path = os.getenv("DOTENV_PATH")
if not dotenv_path:
    dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(dotenv_path):
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

URL_DATABASE = os.getenv("URL_DATABASE", "")
engine_args = {"echo": True}

if URL_DATABASE.startswith("sqlite://"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(URL_DATABASE, **engine_args)

def create_db_and_tables():
    """Khởi tạo toàn bộ cấu trúc bảng cơ sở dữ liệu"""
    import models
    SQLModel.metadata.create_all(engine)
    
def get_session():
    """Cung cấp Database Session cho mỗi API request"""
    with Session(engine) as session:
        yield session

# Dependency dùng chung cho các API Router
SessionDep = Annotated[Session, Depends(get_session)]