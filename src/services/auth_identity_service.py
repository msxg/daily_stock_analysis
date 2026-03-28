# -*- coding: utf-8 -*-
"""User/tenant authentication and principal resolution service."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from src.auth import MIN_PASSWORD_LEN, PBKDF2_ITERATIONS, SESSION_MAX_AGE_HOURS_DEFAULT
from src.storage import DatabaseManager, Tenant, TenantMembership, User, UserSession

DEFAULT_TENANT_SLUG = "default"
DEFAULT_TENANT_NAME = "Default Workspace"

_USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{3,64}$")


@dataclass(frozen=True)
class Principal:
    """Current authenticated identity resolved from session cookie."""

    user_id: int
    username: str
    display_name: str
    email: str
    tenant_id: int
    tenant_slug: str
    tenant_name: str
    tenant_role: str
    is_system_admin: bool
    capabilities: tuple[str, ...]


class AuthIdentityService:
    """Identity service backed by users/tenants/session tables."""

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self._db = db_manager or DatabaseManager.get_instance()

    @staticmethod
    def _normalize_username(value: str) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _validate_username(value: str) -> Optional[str]:
        if not value:
            return "用户名不能为空"
        if not _USERNAME_PATTERN.match(value):
            return "用户名需为 3-64 位，且仅支持字母、数字、.、_、-"
        return None

    @staticmethod
    def _validate_password(value: str) -> Optional[str]:
        if not value or not value.strip():
            return "密码不能为空"
        if len(value) < MIN_PASSWORD_LEN:
            return f"密码至少 {MIN_PASSWORD_LEN} 位"
        return None

    @staticmethod
    def _hash_password(password: str) -> tuple[str, str]:
        salt = secrets.token_bytes(32)
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt=salt,
            iterations=PBKDF2_ITERATIONS,
        )
        return (
            base64.standard_b64encode(salt).decode("ascii"),
            base64.standard_b64encode(derived).decode("ascii"),
        )

    @staticmethod
    def _verify_password(password: str, salt_b64: str, hash_b64: str) -> bool:
        try:
            salt = base64.standard_b64decode((salt_b64 or "").encode("ascii"))
            stored_hash = base64.standard_b64decode((hash_b64 or "").encode("ascii"))
        except (ValueError, TypeError):
            return False

        computed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt=salt,
            iterations=PBKDF2_ITERATIONS,
        )
        return hmac.compare_digest(computed, stored_hash)

    @staticmethod
    def _build_capabilities(is_system_admin: bool, tenant_role: str) -> tuple[str, ...]:
        base_caps = {
            "dashboard.read",
            "chat.read",
            "chat.write",
            "portfolio.read",
            "portfolio.write",
            "backtest.read",
            "analysis.read",
        }
        if tenant_role in {"tenant_admin", "system_admin"}:
            base_caps.add("tenant.users.read")
        if is_system_admin:
            base_caps.update(
                {
                    "system.config.read",
                    "system.config.write",
                    "auth.manage",
                    "users.manage",
                    "tenants.manage",
                }
            )
        return tuple(sorted(base_caps))

    def _get_or_create_default_tenant(self, session: Session) -> Tenant:
        tenant = session.execute(select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG)).scalar_one_or_none()
        if tenant is not None:
            return tenant

        tenant = Tenant(slug=DEFAULT_TENANT_SLUG, name=DEFAULT_TENANT_NAME, status="active")
        session.add(tenant)
        session.flush()
        return tenant

    def _ensure_membership(
        self,
        session: Session,
        *,
        tenant_id: int,
        user_id: int,
        role: str,
        status: str = "active",
    ) -> TenantMembership:
        membership = session.execute(
            select(TenantMembership).where(
                and_(
                    TenantMembership.tenant_id == tenant_id,
                    TenantMembership.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if membership is not None:
            membership.role = role
            membership.status = status
            membership.updated_at = datetime.now()
            return membership

        membership = TenantMembership(
            tenant_id=tenant_id,
            user_id=user_id,
            role=role,
            status=status,
        )
        session.add(membership)
        session.flush()
        return membership

    def has_users(self) -> bool:
        with self._db.session_scope() as session:
            stmt = select(User.id).where(User.status == "active").limit(1)
            return session.execute(stmt).scalar() is not None

    def count_users(self) -> int:
        with self._db.session_scope() as session:
            rows = session.execute(select(User.id)).all()
            return len(rows)

    def create_user(
        self,
        *,
        username: str,
        password: str,
        display_name: Optional[str] = None,
        email: Optional[str] = None,
        is_system_admin: bool = False,
        tenant_role: str = "user",
    ) -> User:
        normalized_username = self._normalize_username(username)
        username_error = self._validate_username(normalized_username)
        if username_error:
            raise ValueError(username_error)

        password_error = self._validate_password(password)
        if password_error:
            raise ValueError(password_error)

        if is_system_admin:
            tenant_role = "tenant_admin"

        salt_b64, hash_b64 = self._hash_password(password)

        with self._db.session_scope() as session:
            exists = session.execute(select(User.id).where(User.username == normalized_username)).scalar_one_or_none()
            if exists is not None:
                raise ValueError("用户名已存在")

            tenant = self._get_or_create_default_tenant(session)
            user = User(
                username=normalized_username,
                display_name=(display_name or "").strip() or normalized_username,
                email=(email or "").strip() or None,
                password_salt=salt_b64,
                password_hash=hash_b64,
                status="active",
                is_system_admin=bool(is_system_admin),
            )
            session.add(user)
            session.flush()

            self._ensure_membership(
                session,
                tenant_id=tenant.id,
                user_id=user.id,
                role=tenant_role,
                status="active",
            )
            session.flush()
            session.expunge(user)
            return user

    def get_user_by_username(self, username: str) -> Optional[User]:
        normalized_username = self._normalize_username(username)
        if not normalized_username:
            return None

        with self._db.session_scope() as session:
            user = session.execute(select(User).where(User.username == normalized_username)).scalar_one_or_none()
            if user is None:
                return None
            session.expunge(user)
            return user

    def verify_user_password(self, *, username: str, password: str) -> Optional[User]:
        normalized_username = self._normalize_username(username)
        if not normalized_username:
            return None

        with self._db.session_scope() as session:
            user = session.execute(
                select(User).where(and_(User.username == normalized_username, User.status == "active"))
            ).scalar_one_or_none()
            if user is None:
                return None
            if not self._verify_password(password, user.password_salt, user.password_hash):
                return None
            user.last_login_at = datetime.now()
            session.flush()
            session.expunge(user)
            return user

    def change_password(self, *, user_id: int, current_password: str, new_password: str) -> Optional[str]:
        password_error = self._validate_password(new_password)
        if password_error:
            return password_error
        if not current_password or not current_password.strip():
            return "请输入当前密码"

        with self._db.session_scope() as session:
            user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            if user is None:
                return "用户不存在"
            if not self._verify_password(current_password, user.password_salt, user.password_hash):
                return "当前密码错误"
            salt_b64, hash_b64 = self._hash_password(new_password)
            user.password_salt = salt_b64
            user.password_hash = hash_b64
            user.updated_at = datetime.now()
            return None

    def admin_reset_password(self, *, user_id: int, new_password: str) -> Optional[str]:
        password_error = self._validate_password(new_password)
        if password_error:
            return password_error

        with self._db.session_scope() as session:
            user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            if user is None or user.status == "deleted":
                return "用户不存在"
            if user.status != "active":
                return "用户状态不可用"

            salt_b64, hash_b64 = self._hash_password(new_password)
            user.password_salt = salt_b64
            user.password_hash = hash_b64
            user.updated_at = datetime.now()

            # Force logout from all existing sessions after admin password reset.
            rows = session.execute(
                select(UserSession).where(
                    and_(
                        UserSession.user_id == user_id,
                        UserSession.revoked_at.is_(None),
                    )
                )
            ).scalars().all()
            now = datetime.now()
            for row in rows:
                row.revoked_at = now
            return None

    def deactivate_user(self, *, user_id: int, operator_user_id: Optional[int] = None) -> Optional[str]:
        with self._db.session_scope() as session:
            user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            if user is None or user.status == "deleted":
                return "用户不存在"
            if operator_user_id and user.id == operator_user_id:
                return "不能删除当前登录账号"

            if user.is_system_admin:
                admin_count = session.execute(
                    select(User.id).where(
                        and_(
                            User.status == "active",
                            User.is_system_admin.is_(True),
                        )
                    )
                ).all()
                if len(admin_count) <= 1:
                    return "至少保留一个系统管理员账号"

            user.status = "deleted"
            user.is_system_admin = False
            user.updated_at = datetime.now()

            memberships = session.execute(
                select(TenantMembership).where(TenantMembership.user_id == user_id)
            ).scalars().all()
            now = datetime.now()
            for membership in memberships:
                membership.status = "inactive"
                membership.updated_at = now

            sessions = session.execute(
                select(UserSession).where(
                    and_(
                        UserSession.user_id == user_id,
                        UserSession.revoked_at.is_(None),
                    )
                )
            ).scalars().all()
            for row in sessions:
                row.revoked_at = now
            return None

    def bootstrap_admin_if_missing(self, *, username: str, password: str) -> User:
        with self._db.session_scope() as session:
            existing_user_id = session.execute(select(User.id).limit(1)).scalar_one_or_none()
            if existing_user_id is not None:
                user = session.execute(select(User).where(User.id == existing_user_id)).scalar_one()
                session.expunge(user)
                return user

        return self.create_user(
            username=username,
            password=password,
            is_system_admin=True,
            tenant_role="tenant_admin",
        )

    def _resolve_default_tenant_membership(self, session: Session, user_id: int) -> tuple[Tenant, TenantMembership]:
        membership = session.execute(
            select(TenantMembership)
            .where(
                and_(
                    TenantMembership.user_id == user_id,
                    TenantMembership.status == "active",
                )
            )
            .order_by(TenantMembership.id.asc())
        ).scalars().first()

        if membership is not None:
            tenant = session.execute(select(Tenant).where(Tenant.id == membership.tenant_id)).scalar_one_or_none()
            if tenant is not None:
                return tenant, membership

        tenant = self._get_or_create_default_tenant(session)
        role = "tenant_admin" if user_id == 1 else "user"
        membership = self._ensure_membership(session, tenant_id=tenant.id, user_id=user_id, role=role)
        return tenant, membership

    def create_session(
        self,
        *,
        user_id: int,
        tenant_id: int,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        max_age_hours: int = SESSION_MAX_AGE_HOURS_DEFAULT,
        session_token: Optional[str] = None,
    ) -> str:
        token = session_token or secrets.token_urlsafe(48)
        now = datetime.now()
        expires_at = now + timedelta(hours=max_age_hours)

        with self._db.session_scope() as session:
            row = UserSession(
                session_token=token,
                user_id=user_id,
                tenant_id=tenant_id,
                issued_at=now,
                expires_at=expires_at,
                client_ip=(client_ip or "")[:64] or None,
                user_agent=(user_agent or "")[:512] or None,
            )
            session.add(row)
        return token

    def revoke_session(self, session_token: str) -> bool:
        if not session_token:
            return False
        with self._db.session_scope() as session:
            row = session.execute(
                select(UserSession).where(UserSession.session_token == session_token)
            ).scalar_one_or_none()
            if row is None:
                return False
            if row.revoked_at is None:
                row.revoked_at = datetime.now()
            return True

    def resolve_principal_from_session(self, session_token: str) -> Optional[Principal]:
        if not session_token:
            return None

        now = datetime.now()
        with self._db.session_scope() as session:
            session_row = session.execute(
                select(UserSession).where(
                    and_(
                        UserSession.session_token == session_token,
                        UserSession.revoked_at.is_(None),
                        UserSession.expires_at > now,
                    )
                )
            ).scalar_one_or_none()
            if session_row is None:
                return None

            user = session.execute(
                select(User).where(
                    and_(
                        User.id == session_row.user_id,
                        User.status == "active",
                    )
                )
            ).scalar_one_or_none()
            if user is None:
                return None

            membership = session.execute(
                select(TenantMembership).where(
                    and_(
                        TenantMembership.user_id == user.id,
                        TenantMembership.tenant_id == session_row.tenant_id,
                        TenantMembership.status == "active",
                    )
                )
            ).scalar_one_or_none()
            if membership is None:
                tenant, membership = self._resolve_default_tenant_membership(session, user.id)
                session_row.tenant_id = tenant.id
            else:
                tenant = session.execute(select(Tenant).where(Tenant.id == session_row.tenant_id)).scalar_one_or_none()
                if tenant is None:
                    return None

            capabilities = self._build_capabilities(bool(user.is_system_admin), membership.role)

            return Principal(
                user_id=user.id,
                username=user.username,
                display_name=user.display_name or user.username,
                email=user.email or "",
                tenant_id=tenant.id,
                tenant_slug=tenant.slug,
                tenant_name=tenant.name,
                tenant_role=membership.role,
                is_system_admin=bool(user.is_system_admin),
                capabilities=capabilities,
            )

    def get_user_public_profile(self, user_id: int) -> Optional[dict]:
        with self._db.session_scope() as session:
            user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            if user is None:
                return None
            return {
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name or user.username,
                "email": user.email,
                "status": user.status,
                "isSystemAdmin": bool(user.is_system_admin),
                "createdAt": user.created_at.isoformat() if user.created_at else None,
            }

    def list_users(self) -> list[dict]:
        with self._db.session_scope() as session:
            users = session.execute(
                select(User).where(User.status != "deleted").order_by(User.id.asc())
            ).scalars().all()
            return [
                {
                    "id": user.id,
                    "username": user.username,
                    "displayName": user.display_name or user.username,
                    "email": user.email,
                    "status": user.status,
                    "isSystemAdmin": bool(user.is_system_admin),
                    "createdAt": user.created_at.isoformat() if user.created_at else None,
                }
                for user in users
            ]

    def list_tenants_for_user(self, user_id: int) -> list[dict]:
        with self._db.session_scope() as session:
            memberships = session.execute(
                select(TenantMembership).where(
                    and_(
                        TenantMembership.user_id == user_id,
                        TenantMembership.status == "active",
                    )
                )
            ).scalars().all()

            items = []
            for membership in memberships:
                tenant = session.execute(select(Tenant).where(Tenant.id == membership.tenant_id)).scalar_one_or_none()
                if tenant is None:
                    continue
                items.append(
                    {
                        "id": tenant.id,
                        "slug": tenant.slug,
                        "name": tenant.name,
                        "role": membership.role,
                    }
                )
            return items

    def ensure_user_default_membership(self, user_id: int) -> tuple[int, str, str, str]:
        with self._db.session_scope() as session:
            tenant, membership = self._resolve_default_tenant_membership(session, user_id)
            return tenant.id, tenant.slug, tenant.name, membership.role
