from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.init_db import init_db
from app.db.session import get_db
from app.api import analyses, interviews, reports, pull_requests, auth, workspaces, webhooks, notifications, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    prod_errors = settings.validate_production_settings()
    if prod_errors and settings.environment.lower() == "production":
        raise RuntimeError(f"Production configuration validation failed: {'; '.join(prod_errors)}")
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

# Allow configured frontend origins plus local dev and Vercel preview deployments
configured_origins = [
    origin.strip()
    for origin in settings.frontend_url.split(",")
    if origin.strip()
]
for local_origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
    if local_origin not in configured_origins:
        configured_origins.append(local_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vercel\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "ok", "version": settings.analyzer_version}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.analyzer_version,
    }


@app.get("/health/ready")
def health_ready(response: Response, db: Session = Depends(get_db)):
    """
    Readiness probe: validates database connectivity and worker readiness.
    Returns 503 if the database is unreachable.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "service": settings.app_name,
            "version": settings.analyzer_version,
        }
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "database": "unavailable",
            "error": "Database connectivity check failed.",
        }


app.include_router(analyses.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(pull_requests.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
