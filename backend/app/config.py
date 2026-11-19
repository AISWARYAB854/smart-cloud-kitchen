from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/smart_kitchen"
    jwt_secret: str
    cors_origins: list[str] = ["http://localhost:5173"]
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
if len(settings.jwt_secret) < 32:
    raise ValueError("JWT_SECRET must contain at least 32 characters")
