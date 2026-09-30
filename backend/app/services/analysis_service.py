from datetime import datetime
from sqlalchemy.orm import Session
from app.models.analysis import Analysis
from app.models.finding import Finding
from app.analyzers.engine import run_static_analysis
from app.services.github_service import fetch_repository
from app.services.ai_service import repository_insights


def analyze_repository(db: Session, analysis_id: str):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        return
    try:
        analysis.status = "running"
        analysis.error = None
        db.commit()

        payload = fetch_repository(analysis.owner, analysis.repo_name)
        meta = payload["meta"]
        files = payload["files"]
        result = run_static_analysis(files)
        context = {
            "repo": {"owner": analysis.owner, "name": analysis.repo_name, "description": meta.get("description"), "topics": meta.get("topics", [])},
            "metrics": result["metrics"],
            "architecture": result["architecture"],
            "findings": result["findings"][:40],
        }
        insights = repository_insights(context)

        analysis.default_branch = meta.get("default_branch")
        analysis.commit_sha = payload.get("commit_sha")
        analysis.metrics = result["metrics"]
        analysis.languages = result["metrics"].get("languages", {})
        analysis.architecture = result["architecture"]
        analysis.file_tree = result["file_tree"]
        analysis.ai_insights = insights
        analysis.summary = insights.get("summary")
        analysis.status = "completed"
        analysis.updated_at = datetime.utcnow()

        for old in list(analysis.findings):
            db.delete(old)
        db.flush()
        for item in result["findings"]:
            db.add(Finding(analysis_id=analysis.id, **item))
        db.commit()
    except Exception as exc:
        db.rollback()
        analysis = db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = "failed"
            analysis.error = str(exc)[:1000]
            db.commit()
