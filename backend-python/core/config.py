import os
from dotenv import load_dotenv
import redis.asyncio as aioredis # type: ignore

load_dotenv()

class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REDIS_URL: str = os.getenv("REDIS_URL")
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

settings = Settings()
