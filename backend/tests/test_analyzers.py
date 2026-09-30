from app.analyzers.engine import run_static_analysis


def test_static_analysis_detects_secret():
    result = run_static_analysis({
        "README.md": "# Demo",
        "app.py": "API_KEY = '1234567890abcdef'\n\ndef hello():\n    return 'ok'\n",
    })
    assert result["metrics"]["total_files"] == 2
    assert any(f["category"] == "security" for f in result["findings"])
