from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.analysis import Analysis
from app.models.finding import Finding


def test_health():
    with TestClient(app) as client:
        response = client.get('/health')
        assert response.status_code == 200
        assert response.json()['status'] == 'healthy'


def test_get_analysis_and_report_with_upgraded_schema():
    db = SessionLocal()
    try:
        analysis = Analysis(
            github_url="https://github.com/test-org/test-repo",
            owner="test-org",
            repo_name="test-repo",
            status="completed",
            summary="A test codebase summary.",
            architecture={
                "components": [
                    {"id": "comp-api-routes", "name": "API Routes & Endpoints", "layer": "api", "file_count": 2, "total_lines": 120}
                ],
                "file_hierarchy": {
                    "name": "root",
                    "path": "",
                    "type": "directory",
                    "file_count": 2,
                    "children": []
                },
                "dependency_graph": {
                    "nodes": [],
                    "edges": [],
                    "circular_dependencies": [],
                    "external_packages": []
                }
            },
            ai_insights={
                "is_ai_generated": False,
                "model": "Deterministic Codebase Intelligence",
                "project_overview": {"summary": "A test codebase summary."},
                "architecture_assessment": {"strengths": ["Clean separation"]},
                "top_recommendations": [
                    {
                        "title": "Add Integration Tests",
                        "priority": "High",
                        "explanation": "No integration tests",
                        "evidence": "tests/ missing",
                        "solution": "Add pytest tests",
                        "expected_benefit": "Zero regressions"
                    }
                ]
            },
            file_tree=[{"path": "main.py", "size": 100, "lines": 10}]
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)

        finding = Finding(
            analysis_id=analysis.id,
            category="security",
            severity="critical",
            confidence="high",
            title="Exposed API Key",
            description="Found raw secret in config.py at line 12",
            file_path="config.py",
            line=12,
            recommendation="Use env vars",
            why_it_matters="Critical credential leak",
            evidence="API_KEY = 'AKIA...'",
            suggested_fix="Move to .env",
            root_cause_group="secret-exposure"
        )
        db.add(finding)
        db.commit()

        with TestClient(app) as client:
            # 1. Test get analysis
            res = client.get(f"/api/v1/analyses/{analysis.id}")
            assert res.status_code == 200
            data = res.json()
            assert data["id"] == analysis.id
            assert len(data["findings"]) == 1
            f_out = data["findings"][0]
            assert f_out["confidence"] == "high"
            assert f_out["why_it_matters"] == "Critical credential leak"
            assert f_out["suggested_fix"] == "Move to .env"
            assert "components" in data["architecture"]
            assert "file_hierarchy" in data["architecture"]

            # 2. Test get files
            res_files = client.get(f"/api/v1/analyses/{analysis.id}/files")
            assert res_files.status_code == 200
            assert len(res_files.json()["files"]) == 1

            # 3. Test get report
            res_rep = client.get(f"/api/v1/reports/{analysis.id}")
            assert res_rep.status_code == 200
            rep_data = res_rep.json()
            assert rep_data["findings"][0]["why_it_matters"] == "Critical credential leak"
            assert rep_data["ai_insights"]["top_recommendations"][0]["title"] == "Add Integration Tests"
    finally:
        db.close()
