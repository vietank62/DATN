from typing import Annotated
from fastapi.params import Depends
from sqlmodel import Session, SQLModel, create_engine
import os
from dotenv import load_dotenv

load_dotenv()

URL_DATABASE = os.getenv(
    "URL_DATABASE"
)

engine = create_engine(URL_DATABASE, echo=True)

def create_db_and_tables():
    import models
    SQLModel.metadata.create_all(engine)
    
def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]