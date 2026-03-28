# -*- coding: utf-8 -*-
"""Authentication endpoints for account-based login with legacy compatibility."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from api.authz import get_identity_service, get_principal, require_system_admin
from api.deps import get_system_config_service
from src.auth import (
    COOKIE_NAME,
    SESSION_MAX_AGE_HOURS_DEFAULT,
    change_password,
    check_rate_limit,
    clear_rate_limit,
    create_session,
    get_client_ip,
    has_stored_password,
    is_auth_enabled,
    is_password_changeable,
    record_login_failure,
    refresh_auth_state,
    rotate_session_secret,
    set_initial_password,
    verify_session,
    verify_stored_password,
)
from src.config import Config, setup_env
from src.core.config_manager import ConfigManager

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginRequest(BaseModel):
    """Login request body."""

    model_config = {"populate_by_name": True}

    username: str = Field(default="", description="Username")
    password: str = Field(default="", description="Password")
    password_confirm: str | None = Field(default=None, alias="passwordConfirm", description="Confirm for bootstrap")


class ChangePasswordRequest(BaseModel):
    """Change password request body."""

    model_config = {"populate_by_name": True}

    current_password: str = Field(default="", alias="currentPassword")
    new_password: str = Field(default="", alias="newPassword")
    new_password_confirm: str = Field(default="", alias="newPasswordConfirm")


class AuthSettingsRequest(BaseModel):
    """Update auth enablement and bootstrap settings."""

    model_config = {"populate_by_name": True}

    auth_enabled: bool = Field(alias="authEnabled")
    username: str = Field(default="")
    password: str = Field(default="")
    password_confirm: str | None = Field(default=None, alias="passwordConfirm")
    current_password: str = Field(default="", alias="currentPassword")


class CreateUserRequest(BaseModel):
    """Create user request body."""

    model_config = {"populate_by_name": True}

    username: str = Field(default="")
    password: str = Field(default="")
    password_confirm: str = Field(default="", alias="passwordConfirm")
    display_name: str = Field(default="", alias="displayName")
    email: str = Field(default="")
    is_system_admin: bool = Field(default=False, alias="isSystemAdmin")


class ResetUserPasswordRequest(BaseModel):
    """Admin reset user password request body."""

    model_config = {"populate_by_name": True}

    new_password: str = Field(default="", alias="newPassword")
    new_password_confirm: str = Field(default="", alias="newPasswordConfirm")


def _cookie_params(request: Request) -> dict:
    """Build cookie params including Secure based on request."""
    secure = False
    headers = getattr(request, "headers", {}) or {}
    url = getattr(request, "url", None)
    scheme = getattr(url, "scheme", "http") if url is not None else "http"
    if os.getenv("TRUST_X_FORWARDED_FOR", "false").lower() == "true":
        proto = headers.get("X-Forwarded-Proto", "").lower()
        secure = proto == "https"
    else:
        secure = scheme == "https"

    try:
        max_age_hours = int(os.getenv("ADMIN_SESSION_MAX_AGE_HOURS", str(SESSION_MAX_AGE_HOURS_DEFAULT)))
    except ValueError:
        max_age_hours = SESSION_MAX_AGE_HOURS_DEFAULT
    max_age = max_age_hours * 3600

    return {
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "path": "/",
        "max_age": max_age,
    }


def _set_session_cookie(response: Response, session_value: str, request: Request) -> None:
    """Attach session cookie to response."""
    params = _cookie_params(request)
    response.set_cookie(
        key=COOKIE_NAME,
        value=session_value,
        httponly=params["httponly"],
        samesite=params["samesite"],
        secure=params["secure"],
        path=params["path"],
        max_age=params["max_age"],
    )


def _apply_auth_enabled(enabled: bool, request: Request | None = None) -> bool:
    """Persist auth toggle to .env and reload runtime config."""
    manager_applied = False
    if request is not None:
        try:
            service = get_system_config_service(request)
            service.apply_simple_updates(
                updates=[("ADMIN_AUTH_ENABLED", "true" if enabled else "false")],
                mask_token="******",
            )
            manager_applied = True
        except Exception as exc:
            logger.warning(
                "Failed to apply auth toggle via shared SystemConfigService, falling back: %s",
                exc,
                exc_info=True,
            )
            manager_applied = False

    if not manager_applied:
        try:
            manager = ConfigManager()
            manager.apply_updates(
                updates=[("ADMIN_AUTH_ENABLED", "true" if enabled else "false")],
                sensitive_keys=set(),
                mask_token="******",
            )
            manager_applied = True
        except Exception as exc:
            logger.error("Failed to apply auth toggle via ConfigManager: %s", exc, exc_info=True)
            manager_applied = False

    if not manager_applied:
        return False

    Config.reset_instance()
    setup_env(override=True)
    refresh_auth_state()
    return True


def _resolve_session_principal(request: Request):
    identity_service = get_identity_service()
    cookies = getattr(request, "cookies", {}) or {}
    cookie_val = cookies.get(COOKIE_NAME)
    if not cookie_val:
        return None

    principal = identity_service.resolve_principal_from_session(cookie_val)
    if principal is not None:
        return principal

    fallback = get_principal(request)
    if fallback is not None:
        return fallback

    if verify_session(cookie_val):
        return {
            "legacy": True,
            "username": "legacy_admin",
            "displayName": "Legacy Admin",
            "isSystemAdmin": True,
            "tenant": {
                "id": 0,
                "slug": "legacy",
                "name": "Legacy Workspace",
                "role": "system_admin",
            },
            "capabilities": [
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
            ],
        }

    return None


def _rollback_auth_enabled(previous_enabled: bool, request: Request) -> None:
    """Best-effort rollback auth-enabled switch when a post-step fails."""
    if is_auth_enabled() == previous_enabled:
        return
    if not _apply_auth_enabled(previous_enabled, request=request):
        logger.error("Failed to rollback auth state to previous value: %s", previous_enabled)


def _get_auth_status_dict(request: Request | None = None) -> dict:
    """Build auth status response for both new and legacy clients."""
    auth_enabled = is_auth_enabled()
    identity_service = get_identity_service()
    has_users = identity_service.has_users()
    has_legacy_password = has_stored_password()
    has_effective_credential = has_legacy_password or (auth_enabled and has_users)

    logged_in = False
    if auth_enabled and request is not None:
        logged_in = _resolve_session_principal(request) is not None

    if auth_enabled:
        setup_state = "enabled" if has_effective_credential else "no_password"
    else:
        setup_state = "password_retained" if has_effective_credential else "no_password"

    return {
        "authEnabled": auth_enabled,
        "loggedIn": logged_in,
        "passwordSet": has_effective_credential if auth_enabled else False,
        "passwordChangeable": is_password_changeable() if auth_enabled else False,
        "setupState": setup_state,
    }


@router.get(
    "/status",
    summary="Get auth status",
    description="Returns whether auth is enabled and if the current request is logged in.",
)
async def auth_status(request: Request):
    """Return auth status without requiring auth."""
    return _get_auth_status_dict(request)


@router.get(
    "/me",
    summary="Get current auth principal",
    description="Returns current user/tenant/role/capabilities for dsa-ui authorization.",
)
async def auth_me(request: Request):
    """Get current principal for role-aware frontend rendering."""
    auth_enabled = is_auth_enabled()
    principal = _resolve_session_principal(request)

    if not auth_enabled:
        return {
            "authenticated": False,
            "authEnabled": False,
            "user": None,
            "activeTenant": None,
            "availableTenants": [],
            "capabilities": [],
        }

    if principal is None:
        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized", "message": "Login required"},
        )

    identity_service = get_identity_service()

    if isinstance(principal, dict):
        return {
            "authenticated": True,
            "authEnabled": True,
            "user": {
                "id": 0,
                "username": principal.get("username", "legacy_admin"),
                "displayName": principal.get("displayName", "Legacy Admin"),
                "email": "",
                "isSystemAdmin": True,
            },
            "activeTenant": principal.get("tenant"),
            "availableTenants": [principal.get("tenant")],
            "capabilities": principal.get("capabilities", []),
        }

    tenants = identity_service.list_tenants_for_user(principal.user_id)
    active_tenant = {
        "id": principal.tenant_id,
        "slug": principal.tenant_slug,
        "name": principal.tenant_name,
        "role": principal.tenant_role,
    }

    return {
        "authenticated": True,
        "authEnabled": True,
        "user": {
            "id": principal.user_id,
            "username": principal.username,
            "displayName": principal.display_name,
            "email": principal.email,
            "isSystemAdmin": principal.is_system_admin,
        },
        "activeTenant": active_tenant,
        "availableTenants": tenants,
        "capabilities": list(principal.capabilities),
    }


@router.post(
    "/settings",
    summary="Update auth settings",
    description="Enable or disable auth. When bootstrapping from empty state, accepts username/password.",
)
async def auth_update_settings(request: Request, body: AuthSettingsRequest):
    """Manage auth enablement with bootstrap support for account mode."""
    target_enabled = body.auth_enabled
    current_enabled = is_auth_enabled()
    identity_service = get_identity_service()

    principal = _resolve_session_principal(request)
    if current_enabled and principal is not None:
        if isinstance(principal, dict):
            pass
        elif not principal.is_system_admin:
            return JSONResponse(
                status_code=403,
                content={"error": "forbidden", "message": "仅系统管理员可修改认证设置"},
            )

    bootstrap_username = (body.username or "").strip().lower() or "admin"
    current_password = (body.current_password or "").strip()
    bootstrap_password = (body.password or "").strip()
    confirm = (body.password_confirm or "").strip()
    has_users = identity_service.has_users()
    legacy_password_exists = has_stored_password()
    verified_user = None

    allow_bootstrap_with_password = target_enabled and not current_enabled and bool(bootstrap_password)

    if target_enabled and not current_enabled and legacy_password_exists and bootstrap_password:
        return JSONResponse(
            status_code=400,
            content={"error": "password_already_set", "message": "认证密码已存在，不能重复覆盖"},
        )

    requires_password_check = False
    if current_enabled and principal is None:
        requires_password_check = True
    if legacy_password_exists and principal is None:
        requires_password_check = True
    if has_users and principal is None and not allow_bootstrap_with_password:
        requires_password_check = True

    if requires_password_check:
        if not current_password:
            return JSONResponse(
                status_code=400,
                content={"error": "current_required", "message": "请输入当前密码"},
            )

        if has_users:
            verified_user = identity_service.verify_user_password(username=bootstrap_username, password=current_password)
            if verified_user is None and bootstrap_username != "admin":
                verified_user = identity_service.verify_user_password(username="admin", password=current_password)

        password_ok = verified_user is not None
        if not password_ok and legacy_password_exists:
            password_ok = verify_stored_password(current_password)
            if password_ok and not has_users:
                try:
                    verified_user = identity_service.bootstrap_admin_if_missing(
                        username=bootstrap_username,
                        password=current_password,
                    )
                    has_users = True
                except ValueError:
                    verified_user = None

        if not password_ok:
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_password", "message": "当前密码错误"},
            )

    if target_enabled and not (has_users or legacy_password_exists):
        if not bootstrap_password:
            return JSONResponse(
                status_code=400,
                content={"error": "password_required", "message": "首次启用认证请设置管理员密码"},
            )
        if bootstrap_password != confirm:
            return JSONResponse(
                status_code=400,
                content={"error": "password_mismatch", "message": "两次输入的密码不一致"},
            )
        if has_stored_password():
            return JSONResponse(
                status_code=400,
                content={"error": "password_already_set", "message": "认证密码已存在，不能重复覆盖"},
            )
        err = set_initial_password(bootstrap_password)
        if err:
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_password", "message": err},
            )
        legacy_password_exists = has_stored_password()
        try:
            verified_user = identity_service.bootstrap_admin_if_missing(
                username=bootstrap_username,
                password=bootstrap_password,
            )
            has_users = True
        except ValueError as exc:
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_user", "message": str(exc)},
            )

    if not target_enabled and not current_enabled:
        response = JSONResponse(content=_get_auth_status_dict(request))
        response.delete_cookie(key=COOKIE_NAME, path="/")
        return response

    if not target_enabled and is_auth_enabled():
        if not rotate_session_secret():
            return JSONResponse(
                status_code=500,
                content={"error": "internal_error", "message": "Failed to invalidate session"},
            )

    if not _apply_auth_enabled(target_enabled, request=request):
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "message": "Failed to update auth settings"},
        )

    # Auth state changed to disabled: clear cookie and return immediately.
    if not target_enabled:
        cookie_val = (getattr(request, "cookies", {}) or {}).get(COOKIE_NAME)
        if cookie_val:
            identity_service.revoke_session(cookie_val)
        response = JSONResponse(content=_get_auth_status_dict(request))
        response.delete_cookie(key=COOKIE_NAME, path="/")
        return response

    # Auth enabled: create session for authenticated/verified principal.
    user_id = None
    tenant_id = None
    if verified_user is not None:
        user_id = verified_user.id
        tenant_id, _, _, _ = identity_service.ensure_user_default_membership(verified_user.id)
    elif not isinstance(principal, dict) and principal is not None:
        user_id = principal.user_id
        tenant_id = principal.tenant_id

    session_token = create_session()
    if not session_token:
        _rollback_auth_enabled(current_enabled, request)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "message": "Failed to create session"},
        )

    if user_id is not None and tenant_id is not None:
        try:
            identity_service.create_session(
                user_id=user_id,
                tenant_id=tenant_id,
                client_ip=get_client_ip(request),
                user_agent=(getattr(request, "headers", {}) or {}).get("User-Agent"),
                session_token=session_token,
            )
        except Exception:
            _rollback_auth_enabled(current_enabled, request)
            logger.exception("Failed to persist auth session")
            return JSONResponse(
                status_code=500,
                content={"error": "internal_error", "message": "Failed to create session"},
            )

    response = JSONResponse(content={**_get_auth_status_dict(request), "loggedIn": True})
    _set_session_cookie(response, session_token, request)
    return response


@router.post(
    "/login",
    summary="Login or bootstrap first admin",
    description="Verify account password and set session cookie. Supports first bootstrap.",
)
async def auth_login(request: Request, body: LoginRequest):
    """Account-based login with legacy-password migration path."""
    if not is_auth_enabled():
        return JSONResponse(
            status_code=400,
            content={"error": "auth_disabled", "message": "Authentication is not configured"},
        )

    username = (body.username or "").strip().lower() or "admin"
    password = (body.password or "").strip()
    if not password:
        return JSONResponse(
            status_code=400,
            content={"error": "password_required", "message": "请输入密码"},
        )

    ip = get_client_ip(request)
    if not check_rate_limit(ip):
        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limited",
                "message": "Too many failed attempts. Please try again later.",
            },
        )

    identity_service = get_identity_service()

    user = None
    if identity_service.has_users():
        user = identity_service.verify_user_password(username=username, password=password)
    else:
        # Migration path: if legacy admin hash exists, verify it and bootstrap first account.
        if has_stored_password():
            if verify_stored_password(password):
                user = identity_service.bootstrap_admin_if_missing(username=username, password=password)
        else:
            confirm = (body.password_confirm or "").strip()
            if password != confirm:
                record_login_failure(ip)
                return JSONResponse(
                    status_code=400,
                    content={"error": "password_mismatch", "message": "Passwords do not match"},
                )
            if has_stored_password():
                record_login_failure(ip)
                return JSONResponse(
                    status_code=400,
                    content={"error": "password_already_set", "message": "认证密码已存在，不能重复覆盖"},
                )
            err = set_initial_password(password)
            if err:
                record_login_failure(ip)
                return JSONResponse(
                    status_code=400,
                    content={"error": "invalid_password", "message": err},
                )
            try:
                user = identity_service.bootstrap_admin_if_missing(username=username, password=password)
            except ValueError as exc:
                record_login_failure(ip)
                return JSONResponse(
                    status_code=400,
                    content={"error": "invalid_user", "message": str(exc)},
                )

    if user is None:
        record_login_failure(ip)
        return JSONResponse(
            status_code=401,
            content={"error": "invalid_password", "message": "密码错误"},
        )

    tenant_id, _, _, _ = identity_service.ensure_user_default_membership(user.id)
    token = create_session()
    if not token:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "message": "Failed to create session"},
        )

    identity_service.create_session(
        user_id=user.id,
        tenant_id=tenant_id,
        client_ip=ip,
        user_agent=(getattr(request, "headers", {}) or {}).get("User-Agent"),
        session_token=token,
    )

    clear_rate_limit(ip)
    response = JSONResponse(content={"ok": True})
    _set_session_cookie(response, token, request)
    return response


@router.post(
    "/change-password",
    summary="Change password",
    description="Change current login user's password.",
)
async def auth_change_password(body: ChangePasswordRequest, request: Request = None):
    """Change password for current user, with legacy fallback."""
    if not is_password_changeable():
        return JSONResponse(
            status_code=400,
            content={"error": "not_changeable", "message": "Password cannot be changed via web"},
        )

    current = (body.current_password or "").strip()
    new_pwd = (body.new_password or "").strip()
    new_confirm = (body.new_password_confirm or "").strip()

    if not current:
        return JSONResponse(
            status_code=400,
            content={"error": "current_required", "message": "请输入当前密码"},
        )
    if new_pwd != new_confirm:
        return JSONResponse(
            status_code=400,
            content={"error": "password_mismatch", "message": "两次输入的新密码不一致"},
        )

    principal = get_principal(request) if request is not None else None
    if principal is not None and principal.user_id > 0:
        err = get_identity_service().change_password(
            user_id=principal.user_id,
            current_password=current,
            new_password=new_pwd,
        )
        if err:
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_password", "message": err},
            )
        return Response(status_code=204)

    # Legacy fallback
    err = change_password(current, new_pwd)
    if err:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_password", "message": err},
        )
    return Response(status_code=204)


@router.post(
    "/logout",
    summary="Logout",
    description="Clear session cookie and invalidate current session.",
)
async def auth_logout(request: Request):
    """Logout current session."""
    cookie_val = (getattr(request, "cookies", {}) or {}).get(COOKIE_NAME)
    if cookie_val:
        get_identity_service().revoke_session(cookie_val)

    # Legacy fallback session invalidation.
    if is_auth_enabled():
        if not rotate_session_secret():
            return JSONResponse(
                status_code=500,
                content={"error": "internal_error", "message": "Failed to invalidate session"},
            )

    response = Response(status_code=204)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response


@router.get(
    "/users",
    summary="List users",
    description="System admin only.",
)
async def auth_list_users(request: Request):
    """List users for admin management."""
    require_system_admin(request)
    return {"users": get_identity_service().list_users()}


@router.post(
    "/users",
    summary="Create user",
    description="System admin only.",
)
async def auth_create_user(request: Request, body: CreateUserRequest):
    """Create user account as system admin."""
    require_system_admin(request)

    username = (body.username or "").strip()
    password = (body.password or "").strip()
    password_confirm = (body.password_confirm or "").strip()

    if not username:
        return JSONResponse(
            status_code=400,
            content={"error": "username_required", "message": "请输入用户名"},
        )
    if not password:
        return JSONResponse(
            status_code=400,
            content={"error": "password_required", "message": "请输入密码"},
        )
    if password != password_confirm:
        return JSONResponse(
            status_code=400,
            content={"error": "password_mismatch", "message": "两次输入的密码不一致"},
        )

    try:
        user = get_identity_service().create_user(
            username=username,
            password=password,
            display_name=(body.display_name or "").strip() or None,
            email=(body.email or "").strip() or None,
            is_system_admin=bool(body.is_system_admin),
            tenant_role="user",
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_user", "message": str(exc)},
        )

    profile = get_identity_service().get_user_public_profile(user.id)
    return {"user": profile}


@router.post(
    "/users/{user_id}/reset-password",
    summary="Reset user password",
    description="System admin only.",
)
async def auth_reset_user_password(request: Request, user_id: int, body: ResetUserPasswordRequest):
    """Reset target user's password as system admin."""
    require_system_admin(request)

    new_password = (body.new_password or "").strip()
    new_password_confirm = (body.new_password_confirm or "").strip()
    if not new_password:
        return JSONResponse(
            status_code=400,
            content={"error": "password_required", "message": "请输入新密码"},
        )
    if new_password != new_password_confirm:
        return JSONResponse(
            status_code=400,
            content={"error": "password_mismatch", "message": "两次输入的新密码不一致"},
        )

    err = get_identity_service().admin_reset_password(user_id=user_id, new_password=new_password)
    if err:
        status_code = 404 if err == "用户不存在" else 400
        return JSONResponse(
            status_code=status_code,
            content={"error": "invalid_user", "message": err},
        )
    return {"ok": True}


@router.delete(
    "/users/{user_id}",
    summary="Delete user",
    description="System admin only.",
)
async def auth_delete_user(request: Request, user_id: int):
    """Soft-delete user account as system admin."""
    return _delete_user_impl(request, user_id)


@router.post(
    "/users/{user_id}/delete",
    summary="Delete user (compat)",
    description="System admin only. Compatibility endpoint for environments that do not allow DELETE.",
)
async def auth_delete_user_compat(request: Request, user_id: int):
    """Soft-delete user account via POST compatibility alias."""
    return _delete_user_impl(request, user_id)


def _delete_user_impl(request: Request, user_id: int):
    """Shared delete implementation used by DELETE and POST compatibility routes."""
    principal = require_system_admin(request)

    operator_user_id = principal.user_id if principal.user_id > 0 else None
    err = get_identity_service().deactivate_user(
        user_id=user_id,
        operator_user_id=operator_user_id,
    )
    if err:
        status_code = 404 if err == "用户不存在" else 400
        return JSONResponse(
            status_code=status_code,
            content={"error": "invalid_user", "message": err},
        )
    return {"deleted": 1}
