# -*- coding: utf-8 -*-
"""
Auth middleware: protect /api/v1/* when admin auth is enabled.
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from api.authz import get_identity_service
from src.auth import COOKIE_NAME, is_auth_enabled, verify_session
from src.services.auth_identity_service import Principal

logger = logging.getLogger(__name__)

EXEMPT_PATHS = frozenset({
    "/api/v1/auth/login",
    "/api/v1/auth/status",
    "/api/health",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})


def _path_exempt(path: str) -> bool:
    """Check if path is exempt from auth."""
    normalized = path.rstrip("/") or "/"
    return normalized in EXEMPT_PATHS


class AuthMiddleware(BaseHTTPMiddleware):
    """Require valid session for /api/v1/* when auth is enabled."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ):
        if not is_auth_enabled():
            return await call_next(request)

        path = request.url.path
        if _path_exempt(path):
            return await call_next(request)

        if not path.startswith("/api/v1/"):
            return await call_next(request)

        cookie_val = request.cookies.get(COOKIE_NAME)
        if not cookie_val:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": "Login required",
                },
            )

        principal = get_identity_service().resolve_principal_from_session(cookie_val)
        if principal is not None:
            request.state.principal = principal
            return await call_next(request)

        # Backward compatibility: keep old file-based admin session valid.
        if verify_session(cookie_val):
            request.state.principal = Principal(
                user_id=0,
                username="legacy_admin",
                display_name="Legacy Admin",
                email="",
                tenant_id=0,
                tenant_slug="legacy",
                tenant_name="Legacy Workspace",
                tenant_role="system_admin",
                is_system_admin=True,
                capabilities=(
                    "analysis.read",
                    "auth.manage",
                    "backtest.read",
                    "chat.read",
                    "chat.write",
                    "dashboard.read",
                    "portfolio.read",
                    "portfolio.write",
                    "system.config.read",
                    "system.config.write",
                    "tenants.manage",
                    "users.manage",
                ),
            )
            return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={
                "error": "unauthorized",
                "message": "Login required",
            },
        )


def add_auth_middleware(app):
    """Add auth middleware to protect API routes.

    The middleware is always registered; whether auth is enforced is determined
    at request time by is_auth_enabled() so the decision stays consistent across
    any runtime configuration reload.
    """
    app.add_middleware(AuthMiddleware)
