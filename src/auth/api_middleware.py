"""Require valid JWT for all /api/v1/* HTTP routes (Voice-Labs APIs)."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from src.auth.constants import ACCESS_TOKEN_COOKIE
from src.auth.jwt_utils import safe_decode


class VoiceLabsAPIMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # Public HTTP paths (not under /api/v1 voice-labs API)
        public_exact = {"/", "/health", "/docs", "/openapi.json", "/redoc"}
        if path in public_exact or path.startswith("/audio/"):
            return await call_next(request)

        if path.startswith("/api/auth"):
            return await call_next(request)

        if not path.startswith("/api/v1/"):
            return await call_next(request)

        token = request.cookies.get(ACCESS_TOKEN_COOKIE)
        if not token:
            auth = request.headers.get("Authorization")
            if auth and auth.startswith("Bearer "):
                token = auth[7:].strip()

        if not token:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        payload = safe_decode(token)
        if not payload:
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)

        role = payload.get("role")
        if role not in ("admin", "user"):
            return JSONResponse({"detail": "Invalid token"}, status_code=401)

        request.state.user_email = payload.get("sub")
        request.state.user_role = role

        return await call_next(request)
