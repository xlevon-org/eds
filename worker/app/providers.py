"""AI provider registry, capability routing, connection checks, and invocation.

There is no default provider: generation is refused until the relevant capability
is explicitly configured and (for hosted providers) a live connection check succeeds.

The ``stub`` provider is an explicitly-selected, deterministic development provider
(no network). It exists so the pipeline is testable end to end without secrets; it is
never selected implicitly.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import httpx

from .config import capability_model, capability_provider, settings
from .pipeline.errors import ProviderNotConfigured

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
    "stub": {
        "label": "Stub (deterministic dev provider)",
        "key_env": "",
        "probe_url": "",
        "header": "",
    },
}

CAPABILITIES = ("text", "vision", "image", "embedding")


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


def _key_present(provider: str) -> bool:
    if provider == "stub":
        return True
    if provider not in PROVIDERS:
        return False
    return bool(settings.provider_keys.get(provider))


def status_for(capability: str, probe: bool = True) -> ProviderStatus:
    """Report status for one capability. Never raises."""
    provider = capability_provider(capability)
    model = capability_model(capability)
    if not provider:
        return ProviderStatus("", "", False, False, f"AI provider for '{capability}' is not set.", model)
    if provider not in PROVIDERS:
        return ProviderStatus(
            provider, provider, False, False,
            f"Unknown provider '{provider}' for '{capability}'. Expected one of: {', '.join(PROVIDERS)}.",
            model,
        )
    spec = PROVIDERS[provider]
    if not _key_present(provider):
        return ProviderStatus(provider, spec["label"], False, False, f"{spec['key_env']} is not set.", model)
    if provider == "stub" or not spec["probe_url"] or not probe:
        return ProviderStatus(provider, spec["label"], True, True, "ok (stub)", model)
    key = settings.provider_keys.get(provider, "")
    try:
        response = httpx.get(spec["probe_url"], headers=_http_headers(spec, key), timeout=10.0)
    except httpx.HTTPError as error:
        return ProviderStatus(provider, spec["label"], True, False,
                              f"Connection failed: {error.__class__.__name__}", model)
    if response.status_code in (401, 403):
        return ProviderStatus(provider, spec["label"], True, False,
                              f"Provider rejected the credentials (HTTP {response.status_code}).", model)
    if not response.is_success:
        return ProviderStatus(provider, spec["label"], True, False,
                              f"Provider probe returned HTTP {response.status_code}.", model)
    return ProviderStatus(provider, spec["label"], True, True, "ok", model)


def check_connection(timeout: float = 10.0) -> ProviderStatus:
    """Backwards-compatible single (text) capability check."""
    return status_for("text")


def capability_status() -> dict:
    return {cap: status_for(cap).to_dict() for cap in CAPABILITIES}


def require(capability: str) -> str:
    """Return the configured provider for a capability or raise ProviderNotConfigured."""
    status = status_for(capability, probe=False)
    if not status.configured:
        raise ProviderNotConfigured(status.reason)
    return status.provider


# --------------------------------------------------------------------------
# Invocation
# --------------------------------------------------------------------------

def text_complete(prompt: str, system: str = "") -> str:
    """Generate text. Raises ProviderNotConfigured when unset."""
    provider = require("text")
    if provider == "stub":
        return _stub_text(prompt, system)
    # Hosted providers: implemented but unverified on this machine (no keys present).
    if provider == "anthropic":
        return _anthropic(prompt, system)
    if provider == "openai":
        return _openai(prompt, system)
    if provider == "gemini":
        return _gemini(prompt, system)
    raise ProviderNotConfigured(f"Provider '{provider}' has no text implementation.")


def _stub_text(prompt: str, system: str = "") -> str:
    """Deterministic, offline text used for local verification and tests."""
    topic = prompt.strip().splitlines()[0][:120] if prompt.strip() else "the topic"
    return (
        f"{topic}. This passage was produced by the deterministic stub provider so the "
        "pipeline can be verified without secrets. Replace AI_PROVIDER with a hosted "
        "provider for authored content."
    )


def _anthropic(prompt: str, system: str) -> str:
    key = settings.provider_keys["anthropic"]
    body = {
        "model": capability_model("text"),
        "max_tokens": 1024,
        "system": system or "You are an instructional designer.",
        "messages": [{"role": "user", "content": prompt}],
    }
    r = httpx.post("https://api.anthropic.com/v1/messages",
                   headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                   json=body, timeout=60.0)
    r.raise_for_status()
    return "".join(block.get("text", "") for block in r.json().get("content", []))


def _openai(prompt: str, system: str) -> str:
    key = settings.provider_keys["openai"]
    body = {
        "model": capability_model("text") or "gpt-4o-mini",
        "messages": ([{"role": "system", "content": system}] if system else [])
        + [{"role": "user", "content": prompt}],
    }
    r = httpx.post("https://api.openai.com/v1/chat/completions",
                   headers={"Authorization": f"Bearer {key}"}, json=body, timeout=60.0)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _gemini(prompt: str, system: str) -> str:
    key = settings.provider_keys["gemini"]
    model = capability_model("text") or "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"parts": [{"text": (system + "\n\n" if system else "") + prompt}]}]}
    r = httpx.post(url, headers={"x-goog-api-key": key}, json=body, timeout=60.0)
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]
