import os
from dotenv import load_dotenv
from typing import Annotated
from fastapi.params import Depends
from sqlmodel import SQLModel, Session, create_engine # type: ignore
from sqlalchemy.orm import declarative_base # type: ignore

load_dotenv()

URL_DATABASE = os.getenv("URL_DATABASE")
engine = create_engine(URL_DATABASE)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    Base.metadata.create_all(engine)
    
def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

Base = declarative_base()