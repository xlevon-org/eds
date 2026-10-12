"""Worker settings, loaded from environment / worker/.env."""

import os
from pathlib import Path

from dotenv import load_dotenv

WORKER_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(WORKER_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.host = _env("HOST", "127.0.0.1")
        self.port = _env_int("WORKER_PORT", 8000)
        self.worker_api_key = _env("WORKER_API_KEY")
        self.backend_base_url = _env("BACKEND_BASE_URL", "http://localhost:5000")
        self.mongodb_uri = _env("MONGODB_URI")
        self.ai_provider = _env("AI_PROVIDER").lower()
        self.ai_model = _env("AI_MODEL")
        self.artifacts_dir = WORKER_ROOT / _env("ARTIFACTS_DIR", "artifacts")
        self.provider_keys = {
            "gemini": _env("GEMINI_API_KEY"),
            "openai": _env("OPENAI_API_KEY"),
            "anthropic": _env("ANTHROPIC_API_KEY"),
        }
        self.weasyprint_base_url = _env("WEASYPRINT_BASE_URL")


settings = Settings()


def is_configured() -> bool:
    """True only when a provider is selected AND its key is present."""
    return bool(settings.ai_provider and settings.provider_keys.get(settings.ai_provider))
