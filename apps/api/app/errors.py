"""One error shape for the whole API: code, message, details, request_id."""

import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"

STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    413: "payload_too_large",
    422: "validation_error",
    429: "rate_limited",
    503: "service_unavailable",
}


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def not_found(message: str) -> ApiError:
    return ApiError(404, "not_found", message)


def error_response(request: Request, status_code: int, code: str, message: str, details: Any):
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "details": details,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


def install_error_handling(app: FastAPI) -> None:
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request.state.request_id
        return response

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError):
        return error_response(request, error.status_code, error.code, error.message, error.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, error: RequestValidationError):
        details = [
            {"field": ".".join(str(part) for part in item["loc"][1:]), "problem": item["msg"]}
            for item in error.errors()
        ]
        return error_response(request, 422, "validation_error", "Invalid parameters", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, error: StarletteHTTPException):
        code = STATUS_CODES.get(error.status_code, "error")
        return error_response(request, error.status_code, code, str(error.detail), None)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception):
        # The stack trace goes to the log, never to the client.
        logger.exception("Unhandled error, request_id=%s", request.state.request_id)
        return error_response(request, 500, "internal_error", "Internal server error", None)
