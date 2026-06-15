"""v1 API routers aggregated into a single APIRouter."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routers import admin, auth, catalog, dashboard, health, me, tasks


def build_v1_router() -> APIRouter:
    router = APIRouter()
    router.include_router(auth.router)
    router.include_router(admin.router)
    router.include_router(me.router)
    router.include_router(catalog.router)
    router.include_router(tasks.router)
    router.include_router(dashboard.router)
    router.include_router(health.router)
    return router


__all__ = ["build_v1_router"]
