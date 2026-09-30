from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.analysis import Analysis

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{analysis_id}")
def get_report(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    latest = sorted(analysis.interviews, key=lambda x: x.created_at, reverse=True)[0] if analysis.interviews else None
    return {
        "repository": {"owner": analysis.owner, "name": analysis.repo_name, "url": analysis.github_url},
        "summary": analysis.summary,
        "metrics": analysis.metrics,
        "architecture": analysis.architecture,
        "ai_insights": analysis.ai_insights,
        "findings": [{"category": f.category, "severity": f.severity, "title": f.title, "description": f.description, "file_path": f.file_path, "line": f.line, "recommendation": f.recommendation} for f in analysis.findings],
        "interview": {
            "score": latest.score,
            "status": latest.status,
            "feedback": latest.feedback,
        } if latest else None,
    }
