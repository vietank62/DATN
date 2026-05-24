from typing import Annotated
from fastapi.params import Depends
from sqlmodel import Session, SQLModel, create_engine
import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

URL_DATABASE = os.getenv(
    "URL_DATABASE"
)

engine_args = {"echo": True}
if URL_DATABASE and URL_DATABASE.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(URL_DATABASE, **engine_args)

def create_db_and_tables():
    import models
    SQLModel.metadata.create_all(engine)
    
def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]