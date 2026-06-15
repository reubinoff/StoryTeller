"""Auth router tests."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient, Response

from app.api.v1.routers import auth as auth_router
from app.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, create_oauth_state, decode_oauth_state
from app.core.session_cookies import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE
from app.db.models.user import User

SIGNUP_BODY = {
    "first_name": "Maya",
    "last_name": "Patel",
    "email": "maya@example.com",
    "password": "Snowflake42!",
    "year_of_birth": 2017,
}


def _assert_csrf_header_matches_cookie(resp: Response) -> None:
    csrf_cookie = resp.cookies.get(CSRF_COOKIE)
    assert csrf_cookie
    assert resp.headers.get(CSRF_HEADER) == csrf_cookie


@pytest.fixture
def configured_google_oauth(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "google-client-id")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "google-client-secret")
    monkeypatch.setenv(
        "GOOGLE_OAUTH_REDIRECT_URI", "http://test/api/v1/auth/google/callback"
    )
    monkeypatch.setenv("FRONTEND_BASE_URL", "http://frontend.test")
    get_settings.cache_clear()
    try:
        yield
    finally:
        get_settings.cache_clear()


@pytest.fixture
def unconfigured_google_oauth(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    get_settings.cache_clear()
    try:
        yield
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_signup_returns_201_with_user_and_cookies(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/signup",
        headers={"Origin": "https://storyteller.reubinoff.com"},
        json=SIGNUP_BODY,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert set(body.keys()) == {"user"}
    user = body["user"]
    assert user["email"] == "maya@example.com"
    assert user["first_name"] == "Maya"
    assert user["grade_level"] >= 1
    assert user["grade_level"] <= 12
    assert user["interests"] == []
    assert user["status"] == "active"
    assert user["theme_preference"] == "light"
    assert user["onboarding_completed"] is False
    set_cookie = resp.headers.get("set-cookie") or ""
    assert f"{ACCESS_COOKIE}=" in set_cookie
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert f"{CSRF_COOKIE}=" in set_cookie
    _assert_csrf_header_matches_cookie(resp)
    assert CSRF_HEADER in resp.headers.get("access-control-expose-headers", "")


@pytest.mark.asyncio
async def test_signup_duplicate_email_returns_409(client: AsyncClient) -> None:
    first = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert first.status_code == 201
    again = await client.post("/auth/signup", json={**SIGNUP_BODY, "first_name": "Other"})
    assert again.status_code == 409
    body = again.json()
    assert body["code"] == "email_taken"
    assert again.headers["content-type"].startswith("application/problem+json")


@pytest.mark.asyncio
async def test_signup_invalid_password_returns_422(client: AsyncClient) -> None:
    bad = {**SIGNUP_BODY, "password": "tooshort"}  # < 8 chars + missing digit
    resp = await client.post("/auth/signup", json=bad)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "validation_error"
    fields = {e["field"] for e in body["errors"]}
    assert "password" in fields


@pytest.mark.asyncio
async def test_signup_year_of_birth_out_of_range_returns_422(client: AsyncClient) -> None:
    bad = {**SIGNUP_BODY, "year_of_birth": 1800}
    resp = await client.post("/auth/signup", json=bad)
    assert resp.status_code == 422
    fields = {e["field"] for e in resp.json()["errors"]}
    assert "year_of_birth" in fields


@pytest.mark.asyncio
async def test_login_happy_path(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post(
        "/auth/login",
        json={"email": SIGNUP_BODY["email"], "password": SIGNUP_BODY["password"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body.keys()) == {"user"}
    assert body["user"]["email"] == SIGNUP_BODY["email"]
    _assert_csrf_header_matches_cookie(resp)


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401_generic(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post(
        "/auth/login",
        json={"email": SIGNUP_BODY["email"], "password": "WrongPass123"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401_generic(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/login", json={"email": "ghost@nope.com", "password": "Password1"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_login_inactive_user_returns_401_generic(
    client: AsyncClient, db_engine
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert signup.status_code == 201
    user_id = uuid.UUID(signup.json()["user"]["id"])
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.status = "suspended"
        await session.commit()

    resp = await client.post(
        "/auth/login",
        json={"email": SIGNUP_BODY["email"], "password": SIGNUP_BODY["password"]},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_logout_returns_204(client: AsyncClient) -> None:
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_me_without_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_google_exchange_returns_410(client: AsyncClient) -> None:
    resp = await client.post("/auth/google/exchange", json={"code": "anything"})
    assert resp.status_code == 410
    assert resp.json()["code"] == "google_exchange_removed"


@pytest.mark.asyncio
async def test_refresh_with_cookie_refreshes_session_cookies(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 204
    set_cookie = resp.headers.get("set-cookie") or ""
    assert f"{ACCESS_COOKIE}=" in set_cookie
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert f"{CSRF_COOKIE}=" in set_cookie
    _assert_csrf_header_matches_cookie(resp)


@pytest.mark.asyncio
async def test_refresh_without_cookie_returns_401(client: AsyncClient) -> None:
    client.cookies.clear()
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_refresh_with_invalid_cookie_returns_401(client: AsyncClient) -> None:
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, "not-a-jwt")
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_refresh_rejects_access_token_cookie(client: AsyncClient) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert signup.status_code == 201
    access_token, _expires_in = create_access_token(signup.json()["user"]["id"])
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, access_token)

    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_refresh_for_inactive_user_returns_401(
    client: AsyncClient, db_engine
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert signup.status_code == 201
    user_id = uuid.UUID(signup.json()["user"]["id"])
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.status = "suspended"
        await session.commit()

    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_logout_clears_refresh_cookie(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204
    set_cookie = resp.headers.get("set-cookie") or ""
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert f"{ACCESS_COOKIE}=" in set_cookie
    assert f"{CSRF_COOKIE}=" in set_cookie
    assert "Max-Age=0" in (resp.headers.get("set-cookie") or "")


@pytest.mark.asyncio
async def test_google_start_without_config_returns_503(
    client: AsyncClient, unconfigured_google_oauth: None
) -> None:
    resp = await client.get("/auth/google/start")
    assert resp.status_code == 503
    assert resp.json()["code"] == "google_oauth_not_configured"


@pytest.mark.asyncio
async def test_google_start_sanitizes_return_to_and_intent(
    client: AsyncClient, configured_google_oauth: None
) -> None:
    resp = await client.get(
        "/auth/google/start",
        params={"return_to": "//evil.example/callback", "intent": "admin"},
    )
    assert resp.status_code == 307
    location = resp.headers["location"]
    parsed = urlparse(location)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == auth_router.GOOGLE_AUTH_URL
    query = parse_qs(parsed.query)
    assert query["client_id"] == ["google-client-id"]
    assert query["redirect_uri"] == ["http://test/api/v1/auth/google/callback"]
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email profile"]
    assert "client_secret" not in query

    state = decode_oauth_state(query["state"][0])
    assert state["return_to"] == "/dashboard"
    assert state["intent"] == "login"


async def _mock_google(monkeypatch: pytest.MonkeyPatch, profile: dict[str, object]) -> None:
    async def exchange(code: str) -> dict[str, object]:
        assert code == "code-123"
        return {"id_token": "id-token-123"}

    async def verify(id_token: str) -> dict[str, object]:
        assert id_token == "id-token-123"
        return profile

    monkeypatch.setattr(auth_router, "_exchange_google_code", exchange)
    monkeypatch.setattr(auth_router, "_verify_google_id_token", verify)


@pytest.mark.asyncio
async def test_google_callback_creates_new_user_and_sets_cookie(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-1",
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Gina",
            "family_name": "Google",
            "picture": "https://example.com/avatar.png",
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/courses", intent="signup")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert resp.headers["location"].endswith("/auth/callback?returnTo=%2Fcourses")
    set_cookie = resp.headers.get("set-cookie") or ""
    assert f"{ACCESS_COOKIE}=" in set_cookie
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert f"{CSRF_COOKIE}=" in set_cookie

    refresh = await client.post("/auth/refresh")
    assert refresh.status_code == 204
    me = await client.get("/me")
    body = me.json()
    assert body["email"] == "google@example.com"
    assert body["first_name"] == "Gina"
    assert body["email_verified"] is True
    assert body["theme_preference"] == "light"
    assert body["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_google_callback_links_existing_verified_email(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    existing_id = signup.json()["user"]["id"]
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-2",
            "email": SIGNUP_BODY["email"],
            "email_verified": True,
            "given_name": "Maya",
            "family_name": "Patel",
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307

    refresh = await client.post("/auth/refresh")
    assert refresh.status_code == 204
    me = await client.get("/me")
    assert me.json()["id"] == existing_id


@pytest.mark.asyncio
async def test_google_callback_rejects_bad_state(client: AsyncClient) -> None:
    resp = await client.get("/auth/google/callback?code=code-123&state=bad-state")
    assert resp.status_code == 307
    assert "error=invalid_oauth_state" in resp.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_oauth_error_redirects_with_error(
    client: AsyncClient, configured_google_oauth: None
) -> None:
    state = create_oauth_state(return_to="/courses", intent="login")
    resp = await client.get(
        "/auth/google/callback",
        params={"state": state, "error": "access_denied"},
    )
    assert resp.status_code == 307
    location = urlparse(resp.headers["location"])
    query = parse_qs(location.query)
    assert f"{location.scheme}://{location.netloc}{location.path}" == (
        "http://frontend.test/auth/callback"
    )
    assert query["returnTo"] == ["/courses"]
    assert query["error"] == ["google_oauth_denied"]
    assert "set-cookie" not in resp.headers


@pytest.mark.asyncio
async def test_google_callback_missing_code_redirects_with_error(
    client: AsyncClient, configured_google_oauth: None
) -> None:
    state = create_oauth_state(return_to="/courses", intent="login")
    resp = await client.get("/auth/google/callback", params={"state": state})
    assert resp.status_code == 307
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert query["returnTo"] == ["/courses"]
    assert query["error"] == ["missing_google_code"]
    assert "set-cookie" not in resp.headers


@pytest.mark.asyncio
async def test_google_callback_token_exchange_failure_redirects_with_error(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    configured_google_oauth: None,
) -> None:
    async def exchange(code: str) -> dict[str, object]:
        assert code == "code-123"
        raise AppError(
            status_code=401,
            code="google_token_exchange_failed",
            title="Google sign-in failed",
        )

    monkeypatch.setattr(auth_router, "_exchange_google_code", exchange)
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert query["error"] == ["google_token_exchange_failed"]
    assert "set-cookie" not in resp.headers


@pytest.mark.asyncio
async def test_google_callback_rejects_unverified_email(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-3",
            "email": "unverified@example.com",
            "email_verified": False,
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert "error=google_email_unverified" in resp.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_rejects_suspended_existing_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db_engine
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    user_id = uuid.UUID(signup.json()["user"]["id"])
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.status = "suspended"
        await session.commit()

    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-4",
            "email": SIGNUP_BODY["email"],
            "email_verified": True,
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert "error=invalid_credentials" in resp.headers["location"]


@pytest.mark.parametrize(
    ("path", "expected_status", "expected_code"),
    [
        ("/auth/email/verify/request", 204, None),
        ("/auth/email/verify/confirm", 204, None),
        ("/auth/password/forgot", 204, None),
        ("/auth/password/reset", 501, "not_implemented"),
    ],
)
@pytest.mark.asyncio
async def test_email_and_password_stub_endpoints(
    client: AsyncClient,
    path: str,
    expected_status: int,
    expected_code: str | None,
) -> None:
    resp = await client.post(path)
    assert resp.status_code == expected_status
    if expected_code is None:
        assert not resp.content
    else:
        assert resp.json()["code"] == expected_code
