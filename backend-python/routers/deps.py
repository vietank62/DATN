from typing import Annotated
from fastapi import Depends, HTTPException, status, Security, Header
from fastapi.security import SecurityScopes
from core.security import oauth2_scheme, decode_token
from database import SessionDep
from models.user import User
from sqlmodel import select # type: ignore

async def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep #type: ignore
) -> User:
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )
    
    payload = decode_token(token)
    email: str = payload.get("email")
    if email is None:
        raise credentials_exception
    
    token_scopes = payload.get("scopes", [])
    
    user = session.exec(
        select(User).where(User.email == email)
    ).first()
    if user is None:
        raise credentials_exception
        
    for scope in security_scopes.scopes:
        if scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )
    return user


async def get_optional_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: SessionDep = None,  # type: ignore
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None

    payload = decode_token(token)
    email: str = payload.get("email")
    if email is None:
        return None

    user = session.exec(
        select(User).where(User.email == email)
    ).first()
    return user
