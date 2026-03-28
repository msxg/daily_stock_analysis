# -*- coding: utf-8 -*-
"""Authorization helpers for API endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, Request

from src.auth import is_auth_enabled
from src.config import get_config
from src.services.auth_identity_service import AuthIdentityService, Principal
from src.storage import DatabaseManager


_identity_service: Optional[AuthIdentityService] = None
_identity_service_db_url: Optional[str] = None


def get_identity_service() -> AuthIdentityService:
    """Return identity service with DB-url aware cache for test/runtime safety."""
    global _identity_service, _identity_service_db_url

    target_db_url = get_config().get_db_url()
    if _identity_service is None or _identity_service_db_url != target_db_url:
        if _identity_service_db_url is not None and _identity_service_db_url != target_db_url:
            DatabaseManager.reset_instance()
        _identity_service = AuthIdentityService(db_manager=DatabaseManager.get_instance())
        _identity_service_db_url = target_db_url
    return _identity_service


def reset_identity_service_cache() -> None:
    """Reset identity service singleton (used by tests)."""
    global _identity_service, _identity_service_db_url
    _identity_service = None
    _identity_service_db_url = None


def get_principal(request: Request) -> Optional[Principal]:
    state = getattr(request, "state", None)
    principal = getattr(state, "principal", None)
    if principal is None:
        return None
    if isinstance(principal, Principal):
        return principal
    return None


def require_authenticated_principal(request: Request) -> Principal:
    principal = get_principal(request)
    if principal is None:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "unauthorized",
                "message": "Login required",
            },
        )
    return principal


def require_system_admin(request: Request) -> Principal:
    principal = require_authenticated_principal(request)
    if not principal.is_system_admin:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "forbidden",
                "message": "System admin permission required",
            },
        )
    return principal


def is_runtime_auth_enabled() -> bool:
    return is_auth_enabled()
