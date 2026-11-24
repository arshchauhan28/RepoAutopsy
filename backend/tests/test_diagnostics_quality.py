import pytest
from app.analyzers.findings import detect_findings, deduplicate_and_group
from app.analyzers.engine import run_static_analysis
from app.schemas.analysis import FindingOut


def test_broad_except_exception_pass_detected_as_medium():
    """1. Broad except Exception: pass should be detected as medium severity."""
    code = """
def process_data(payload):
    try:
        data = parse_payload(payload)
    except Exception:
        pass
    return data
"""
    findings = detect_findings({"service.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 1
    f = rel_findings[0]
    assert f["severity"] == "medium"
    assert "Broad Silent Exception Swallowing" in f["title"]
    assert f["detection_method"] == "AST-Confirmed Pattern"
    assert "Catch specific expected exception types" in f["suggested_fix"]


def test_bare_except_pass_detected_as_medium():
    """Bare except: pass is broad suppression."""
    code = """
def fetch_config():
    try:
        val = read_env()
    except:
        pass
"""
    findings = detect_findings({"config.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 1
    assert rel_findings[0]["severity"] == "medium"
    assert "bare except" in rel_findings[0]["source_reference"]["symbol"]


def test_narrow_expected_exception_suppression_low_severity():
    """2. Narrow expected exceptions like KeyError or FileNotFoundError should be Low severity."""
    code = """
def get_header(headers):
    try:
        return headers["optional-flag"]
    except KeyError:
        pass
    return None
"""
    findings = detect_findings({"headers.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 1
    f = rel_findings[0]
    assert f["severity"] == "low"
    assert "Silent Exception Suppression (KeyError)" in f["title"]
    assert "contextlib.suppress" in f["suggested_fix"]
    assert "optional dictionary key access" in f["when_intentional"]


def test_critical_operation_broad_exception_high_severity():
    """3. Broad exception in critical/transactional function should escalate to High severity."""
    code = """
def commit_transaction(db_session, payment_token):
    try:
        db_session.commit()
    except Exception:
        pass
"""
    findings = detect_findings({"billing.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 1
    assert rel_findings[0]["severity"] == "high"
    assert "critical or security-sensitive" in rel_findings[0]["why_it_matters"]


def test_nested_exception_handlers():
    """4. Nested exception handlers handled accurately with distinct lines."""
    code = """
def nested_lookup():
    try:
        primary()
    except KeyError:
        try:
            fallback()
        except Exception:
            pass
"""
    findings = detect_findings({"lookup.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 1
    assert rel_findings[0]["severity"] == "medium"
    assert rel_findings[0]["line"] == 8


def test_multiple_exception_handlers_in_one_file():
    """5. Multiple distinct exception handlers in one file."""
    code = """
def task_a():
    try:
        step_one()
    except ValueError:
        pass

def task_b():
    try:
        step_two()
    except Exception:
        pass
"""
    findings = detect_findings({"tasks.py": code})
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel_findings) == 2
    severities = {f["severity"] for f in rel_findings}
    assert severities == {"low", "medium"}


def test_handler_with_ellipsis_no_op():
    """7. Handlers containing '...' are detected as silent."""
    code = """
def stub_call():
    try:
        do_work()
    except Exception:
        ...
"""
    findings = detect_findings({"worker.py": code})
    rel = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel) == 1
    assert rel[0]["severity"] == "medium"


def test_handler_that_logs_is_not_flagged():
    """8. Handlers that log or handle the exception are NOT flagged as silent swallows."""
    code = """
import logging

def clean_worker():
    try:
        do_work()
    except Exception as exc:
        logging.exception("Failed work: %s", exc)
"""
    findings = detect_findings({"clean.py": code})
    rel = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel) == 0


def test_handler_that_reraises_is_not_flagged():
    """9. Handlers that re-raise are NOT flagged."""
    code = """
def risky():
    try:
        do_work()
    except Exception:
        raise
"""
    findings = detect_findings({"risky.py": code})
    rel = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel) == 0


def test_handler_with_fallback_logic_is_not_flagged():
    """10. Handlers with fallback assignments/logic are NOT flagged."""
    code = """
def with_fallback():
    try:
        val = get_primary()
    except KeyError:
        val = get_default()
    return val
"""
    findings = detect_findings({"fallback.py": code})
    rel = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel) == 0


def test_valid_source_line_references():
    """11. Line number must accurately point to the except handler."""
    code = """# Header
# Line 2
# Line 3
def inspect_line():
    try:
        work()
    except Exception:
        pass
"""
    findings = detect_findings({"service_line.py": code})
    rel = [f for f in findings if f["rule_id"] == "REL-002"]
    assert len(rel) == 1
    assert rel[0]["line"] == 7
    assert rel[0]["source_reference"]["start_line"] == 7


def test_accurate_detection_method_labels():
    """13. Truthful detection method labels without absolute claims."""
    code = """
def inspect():
    try:
        work()
    except Exception:
        pass
"""
    findings = detect_findings({"ast_test.py": code})
    for f in findings:
        assert f["detection_method"] in {"AST-Confirmed Pattern", "Heuristic Detection"}


def test_occurrence_deduplication():
    """14. Identical findings in deduplicate_and_group are not duplicated."""
    items = [
        {"rule_id": "REL-002", "file_path": "a.py", "line": 10, "title": "Test Finding", "severity": "low"},
        {"rule_id": "REL-002", "file_path": "a.py", "line": 10, "title": "Test Finding", "severity": "low"},
    ]
    deduped = deduplicate_and_group(items)
    assert len(deduped) == 1


def test_old_report_compatibility_pydantic():
    """17. Pydantic FindingOut schema gracefully parses old and new findings."""
    old_finding = {
        "id": "find-1",
        "category": "reliability",
        "severity": "medium",
        "confidence": "high",
        "title": "Legacy Finding",
        "description": "Legacy finding description",
        "file_path": "legacy.py",
        "line": 42,
    }
    obj = FindingOut.model_validate(old_finding)
    assert obj.id == "find-1"
    assert obj.when_intentional is None
    assert obj.detection_method is None

    new_finding = {
        **old_finding,
        "when_intentional": "Common in fallback probing",
        "detection_method": "AST-Confirmed Pattern",
    }
    new_obj = FindingOut.model_validate(new_finding)
    assert new_obj.when_intentional == "Common in fallback probing"
    assert new_obj.detection_method == "AST-Confirmed Pattern"


def test_starlette_simulated_findings_classification():
    """Starlette-like route matching and websocket disconnect are classified as Low."""
    starlette_mock = {
        "starlette/routing.py": """
for route in self.routes:
    try:
        return route.url_path_for(name)
    except NoMatchFound:
        pass
""",
        "starlette/websockets.py": """
async def iter_text(self):
    try:
        while True:
            yield await self.receive_text()
    except WebSocketDisconnect:
        pass
""",
        "starlette/staticfiles.py": """
try:
    if if_modified_since >= last_modified:
        return True
except KeyError:
    pass
""",
    }
    findings = detect_findings(starlette_mock)
    rel_findings = [f for f in findings if f["rule_id"] == "REL-002"]
    # All three narrow exceptions should be Low severity!
    assert len(rel_findings) == 3
    for f in rel_findings:
        assert f["severity"] == "low"
        assert f["detection_method"] == "AST-Confirmed Pattern"
