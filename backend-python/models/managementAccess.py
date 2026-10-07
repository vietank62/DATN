from sqlmodel import SQLModel, Field


class ManagementAccess(SQLModel, table=True):
    __tablename__ = "management_access"
    user_id: int = Field(primary_key=True, foreign_key="user.userId")
    password_hash: str | None = None
    failed_attempts: int = Field(default=0)
    locked_until: float = Field(default=0)
