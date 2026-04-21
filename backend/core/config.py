from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "MindCanvas"
    database_url: str = "sqlite+aiosqlite:///./mindcanvas.db"
    secret_key: str = "change-me-in-production-min-32-chars-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    encryption_key: str = "change-me-in-production-min-32-chars-long"
    encryption_salt: str = "mindcanvas-salt"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
