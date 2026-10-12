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

        # Per-capability provider selection. There is no default: text comes from
        # AI_PROVIDER; vision/image/embedding are explicit and never inherit a
        # different modality implicitly.
        self.ai_provider = _env("AI_PROVIDER").lower()
        self.ai_model = _env("AI_MODEL")
        self.ai_vision_provider = _env("AI_VISION_PROVIDER").lower()
        self.ai_vision_model = _env("AI_VISION_MODEL")
        self.ai_image_provider = _env("AI_IMAGE_PROVIDER").lower()
        self.ai_image_model = _env("AI_IMAGE_MODEL")
        self.ai_embed_provider = _env("AI_EMBED_PROVIDER").lower()
        self.ai_embed_model = _env("AI_EMBED_MODEL")

        self.artifacts_dir = WORKER_ROOT / _env("ARTIFACTS_DIR", "artifacts")
        self.provider_keys = {
            "gemini": _env("GEMINI_API_KEY"),
            "openai": _env("OPENAI_API_KEY"),
            "anthropic": _env("ANTHROPIC_API_KEY"),
        }
        self.weasyprint_base_url = _env("WEASYPRINT_BASE_URL")
        self.kb_chunk_tokens = _env_int("KB_CHUNK_TOKENS", 400)
        self.kb_top_k = _env_int("KB_TOP_K", 6)
        self.pdf_render_enabled = _env("PDF_RENDER_ENABLED", "true").lower() not in (
            "0",
            "false",
            "no",
        )
        # When true, a document whose fit preflight still reports error-level
        # overflow after auto-fit is surfaced as a fit warning (never a silent pass).
        self.fit_strict = _env("FIT_STRICT", "false").lower() in ("1", "true", "yes")


settings = Settings()


def capability_provider(capability: str) -> str:
    """Resolve the explicitly configured provider for a capability (or '')."""
    if capability == "text":
        return settings.ai_provider
    if capability == "vision":
        return settings.ai_vision_provider
    if capability == "image":
        return settings.ai_image_provider
    if capability == "embedding":
        return settings.ai_embed_provider
    return ""


def capability_model(capability: str) -> str:
    if capability == "text":
        return settings.ai_model
    if capability == "vision":
        return settings.ai_vision_model
    if capability == "image":
        return settings.ai_image_model
    if capability == "embedding":
        return settings.ai_embed_model
    return ""


def is_configured() -> bool:
    """True only when the text provider is selected AND its key is present (or it is the stub)."""
    provider = capability_provider("text")
    if not provider:
        return False
    if provider == "stub":
        return True
    return bool(settings.provider_keys.get(provider))
