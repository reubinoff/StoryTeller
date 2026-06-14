"""Password hashing (Argon2id) and JWT encoding/decoding."""

from __future__ import annotations

import time
import uuid
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import get_settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _password_hasher.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(user_id: str) -> tuple[str, int]:
    settings = get_settings()
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + settings.jwt_access_ttl_seconds,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.jwt_access_ttl_seconds


def create_refresh_token(user_id: str) -> tuple[str, int]:
    settings = get_settings()
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + settings.jwt_refresh_ttl_seconds,
        "typ": "refresh",
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.jwt_refresh_ttl_seconds


def decode_refresh_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("typ") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload


def create_oauth_state(*, return_to: str, intent: str) -> str:
    settings = get_settings()
    now = int(time.time())
    payload: dict[str, Any] = {
        "return_to": return_to,
        "intent": intent,
        "iat": now,
        "exp": now + 10 * 60,
        "typ": "google_oauth_state",
        "nonce": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_oauth_state(token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("typ") != "google_oauth_state":
        raise jwt.InvalidTokenError("Not an OAuth state token")
    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
