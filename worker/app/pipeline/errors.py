"""Typed exceptions for the generation pipeline."""


class WorkerError(Exception):
    """Base class for worker errors with an HTTP-friendly status code."""

    status_code = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ProviderNotConfigured(WorkerError):
    status_code = 503


class StageNotImplemented(WorkerError):
    status_code = 501

    def __init__(self, stage: str) -> None:
        super().__init__(f"Pipeline stage '{stage}' is not implemented yet.")
        self.stage = stage


class ValidationError(WorkerError):
    status_code = 422


class PdfUnavailable(WorkerError):
    status_code = 503
