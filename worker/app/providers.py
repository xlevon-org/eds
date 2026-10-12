"""AI provider registry and connection checks.

There is no default provider: generation is refused until ``AI_PROVIDER`` is set
and a live connection check succeeds.
"""

from dataclasses import asdict, dataclass

import httpx

from .config import settings

PROVIDERS = {
    "gemini": {
        "label": "Google Gemini",
        "key_env": "GEMINI_API_KEY",
        "probe_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "header": "x-goog-api-key",
    },
    "openai": {
        "label": "OpenAI",
        "key_env": "OPENAI_API_KEY",
        "probe_url": "https://api.openai.com/v1/models",
        "header": "Authorization",
        "prefix": "Bearer ",
    },
    "anthropic": {
        "label": "Anthropic",
        "key_env": "ANTHROPIC_API_KEY",
        "probe_url": "https://api.anthropic.com/v1/models",
        "header": "x-api-key",
    },
}


@dataclass
class ProviderStatus:
    provider: str
    label: str
    configured: bool
    reachable: bool
    reason: str
    model: str

    def to_dict(self) -> dict:
        return asdict(self)


def _http_headers(spec: dict, key: str) -> dict:
    return {spec["header"]: f"{spec.get('prefix', '')}{key}"}


def check_connection(timeout: float = 10.0) -> ProviderStatus:
    """Probe the configured provider. Never raises; reports the failure reason."""
    provider = settings.ai_provider
    if not provider:
        return ProviderStatus("", "", False, False, "AI_PROVIDER is not set.", settings.ai_model)
    if provider not in PROVIDERS:
        return ProviderStatus(
            provider, provider, False, False,
            f"Unknown AI_PROVIDER '{provider}'. Expected one of: {', '.join(PROVIDERS)}.",
            settings.ai_model,
        )

    spec = PROVIDERS[provider]
    key = settings.provider_keys.get(provider, "")
    if not key:
        return ProviderStatus(
            provider, spec["label"], False, False,
            f"{spec['key_env']} is not set.", settings.ai_model,
        )

    try:
        response = httpx.get(
            spec["probe_url"], headers=_http_headers(spec, key), timeout=timeout
        )
    except httpx.HTTPError as error:
        return ProviderStatus(
            provider, spec["label"], True, False,
            f"Connection failed: {error.__class__.__name__}: {error}", settings.ai_model,
        )

    if response.status_code in (401, 403):
        return ProviderStatus(
            provider, spec["label"], True, False,
            f"Provider rejected the credentials (HTTP {response.status_code}).", settings.ai_model,
        )
    if not response.is_success:
        return ProviderStatus(
            provider, spec["label"], True, False,
            f"Provider probe returned HTTP {response.status_code}.", settings.ai_model,
        )

    return ProviderStatus(provider, spec["label"], True, True, "ok", settings.ai_model)
