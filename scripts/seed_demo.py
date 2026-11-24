import uuid
import sys
import os

sys.path.insert(0, os.path.abspath('backend'))

from app.db.session import SessionLocal
from app.models.analysis import Analysis
from app.models.finding import Finding

db = SessionLocal()
analysis_id = "demo-diagnostics-issue9"
existing = db.get(Analysis, analysis_id)
if existing:
    db.delete(existing)
    db.commit()

analysis = Analysis(
    id=analysis_id,
    github_url="https://github.com/encode/starlette",
    owner="encode",
    repo_name="starlette",
    default_branch="main",
    commit_sha="a1b2c3d4e5f6",
    status="completed",
    summary="Starlette is a lightweight ASGI framework/toolkit, ideal for building async web services.",
    metrics={"total_files": 42, "languages": {"Python": 85.0, "Other": 15.0}},
    architecture={
        "components": [
            {"id": "comp-routing", "name": "Routing & Endpoints", "layer": "api", "role": "HTTP routing", "file_count": 6},
            {"id": "comp-static", "name": "Static Files Server", "layer": "presentation", "role": "Static file serving", "file_count": 3},
            {"id": "comp-websockets", "name": "WebSocket Protocol", "layer": "api", "role": "WebSocket handling", "file_count": 4},
        ],
        "coverage": {
            "successfully_parsed": 38,
            "total_files": 42,
            "partially_analyzed": 4,
            "unsupported_files": 0,
            "skipped_files": 0,
            "is_full_coverage": True,
        },
    },
    findings=[],
)
db.add(analysis)

sample_findings = [
    Finding(
        id=str(uuid.uuid4()),
        analysis_id=analysis_id,
        rule_id="REL-002",
        category="reliability",
        severity="medium",
        confidence="review_recommended",
        title="Broad Silent Exception Swallowing (Blank pass)",
        description="Unhandled broad exception block ('except Exception:') silently suppressed with blank pass in starlette/middleware/body_limit.py at line 95.",
        file_path="starlette/middleware/body_limit.py",
        line=95,
        why_it_matters="A broad catch block intercepts all runtime errors including programming bugs and network timeouts. Suppressing it without inspection makes debugging difficult and conceals unexpected failures.",
        evidence="except Exception:\n    pass",
        suggested_fix="Catch specific expected exception types instead of broad Exception. If the exception must be suppressed, log diagnostic details using logger.warning().",
        root_cause_group="broad-silent-exception",
        evidence_type="ast_confirmed_pattern",
    ),
    Finding(
        id=str(uuid.uuid4()),
        analysis_id=analysis_id,
        rule_id="REL-002",
        category="reliability",
        severity="low",
        confidence="review_recommended",
        title="Silent Exception Suppression (NoMatchFound)",
        description="Specific exception ('except NoMatchFound:') suppressed with blank pass in starlette/routing.py at line 457.",
        file_path="starlette/routing.py",
        line=457,
        why_it_matters="Catching NoMatchFound and passing discards the error. While common for fallback candidate iteration, it should be confirmed intentional.",
        evidence="except NoMatchFound:\n    pass",
        suggested_fix="Verify that swallowing NoMatchFound is deliberate. If this represents expected fallback iteration, consider using contextlib.suppress(NoMatchFound) or adding an inline comment.",
        root_cause_group="narrow-silent-exception",
        evidence_type="ast_confirmed_pattern",
    ),
    Finding(
        id=str(uuid.uuid4()),
        analysis_id=analysis_id,
        rule_id="REL-002",
        category="reliability",
        severity="low",
        confidence="review_recommended",
        title="Silent Exception Suppression (NoMatchFound)",
        description="Specific exception ('except NoMatchFound:') suppressed with blank pass in starlette/routing.py at line 519.",
        file_path="starlette/routing.py",
        line=519,
        why_it_matters="Catching NoMatchFound and passing discards the error.",
        evidence="except NoMatchFound:\n    pass",
        suggested_fix="Verify that swallowing NoMatchFound is deliberate.",
        root_cause_group="narrow-silent-exception",
        evidence_type="ast_confirmed_pattern",
    ),
    Finding(
        id=str(uuid.uuid4()),
        analysis_id=analysis_id,
        rule_id="REL-002",
        category="reliability",
        severity="low",
        confidence="review_recommended",
        title="Silent Exception Suppression (KeyError)",
        description="Specific exception ('except KeyError:') suppressed with blank pass in starlette/staticfiles.py at line 217.",
        file_path="starlette/staticfiles.py",
        line=217,
        why_it_matters="Catching KeyError and passing discards the error.",
        evidence="except KeyError:\n    pass",
        suggested_fix="Verify that swallowing KeyError is deliberate. Consider using dict.get() or contextlib.suppress(KeyError).",
        root_cause_group="narrow-silent-exception",
        evidence_type="ast_confirmed_pattern",
    ),
    Finding(
        id=str(uuid.uuid4()),
        analysis_id=analysis_id,
        rule_id="REL-002",
        category="reliability",
        severity="low",
        confidence="review_recommended",
        title="Silent Exception Suppression (WebSocketDisconnect)",
        description="Specific exception ('except WebSocketDisconnect:') suppressed with blank pass in starlette/websockets.py at line 148.",
        file_path="starlette/websockets.py",
        line=148,
        why_it_matters="Catching WebSocketDisconnect and passing terminates generator.",
        evidence="except WebSocketDisconnect:\n    pass",
        suggested_fix="Verify that generator termination via WebSocketDisconnect is intentional.",
        root_cause_group="narrow-silent-exception",
        evidence_type="ast_confirmed_pattern",
    ),
]

for f in sample_findings:
    db.add(f)
db.commit()
print("Successfully seeded demo-diagnostics-issue9")
