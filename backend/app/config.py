from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_api_version: str = "2024-08-01-preview"

    # Auth
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # Gmail
    gmail_address: str = ""
    gmail_app_password: str = ""
    gmail_imap_server: str = "imap.gmail.com"
    gmail_smtp_server: str = "smtp.gmail.com"
    gmail_poll_interval_seconds: int = 30

    # Telegram
    telegram_bot_token: str = ""
    telegram_use_polling: bool = True

    # Meta — WhatsApp
    whatsapp_phone_number_id: str = ""
    meta_access_token: str = ""
    whatsapp_verify_token: str = ""
    meta_app_secret: str = ""

    # Meta — Instagram
    instagram_page_id: str = ""

    # Storage paths
    data_dir: str = "./data"
    sqlite_db_path: str = "./data/contextflow.db"
    lancedb_path: str = "./data/lancedb"
    upload_dir: str = "./data/uploads"

    @property
    def sqlite_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.sqlite_db_path}"

    def ensure_dirs(self) -> None:
        for path in [self.data_dir, self.lancedb_path, self.upload_dir]:
            Path(path).mkdir(parents=True, exist_ok=True)


settings = Settings()
