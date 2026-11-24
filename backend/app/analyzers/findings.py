from __future__ import annotations

import ast
import hashlib
import math
import re
from pathlib import PurePosixPath
from app.analyzers.classifier import classify_file

# Files to completely ignore during security & quality scanning
IGNORED_PATTERNS = [
    r"\.min\.(?:js|css)$",
    r"\.bundle\.(?:js|css)$",
    r"\.map$",
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"pnpm-lock\.yaml$",
    r"poetry\.lock$",
    r"\.svg$",
    r"node_modules/",
    r"\.git/",
    r"dist/",
    r"build/",
    r"\.next/",
    r"__pycache__/",
    r"\.venv/",
    r"venv/",
]

# Files where credentials / mocks are expected and should NOT trigger secret alerts
TEST_OR_SAMPLE_PATTERNS = [
    r"(?:^|/)(?:tests?|__tests__|spec|specs|fixtures|mocks|examples|testdata|stubs)(?:/|$)",
    r"(?:test_[^/]+\.py|.*_test\.py|.*\.test\.[a-z]+|.*\.spec\.[a-z]+)$",
    r"\.env\.example$",
    r"\.env\.sample$",
    r"\.env\.template$",
    r"README(?:\.[a-z]+)?$",
    r"CHANGELOG(?:\.[a-z]+)?$",
    r"CONTRIBUTING(?:\.[a-z]+)?$",
]

DUMMY_SECRET_VALUES = {
    "your_key", "your_api_key", "your_token", "your_secret", "your-secret-key",
    "placeholder", "changeme", "change_me", "test", "test_key", "test_token",
    "dummy", "dummy_key", "1234567890", "1234567890abcdef", "0123456789abcdef",
    "abcdef123456", "xxxxxxxxxxxx", "undefined", "null", "none",
}

# Regex secret detectors with known high-confidence token formats
HIGH_CONFIDENCE_SECRET_PATTERNS = [
    (
        "SEC-001",
        "Exposed AWS Access Key",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "Critical cloud credential exposed in source code. Allows direct access to AWS resources.",
        "Immediately revoke this key in the AWS IAM Console, rotate credentials, and load from environment variables (AWS_ACCESS_KEY_ID).",
    ),
    (
        "SEC-001",
        "Exposed GitHub Personal Access Token",
        re.compile(r"\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"),
        "Personal access token with GitHub API privileges is committed to source control.",
        "Revoke the token in GitHub Settings -> Developer settings -> Personal access tokens, and inject via environment variables or GitHub Actions Secrets.",
    ),
    (
        "SEC-001",
        "Exposed OpenAI / Groq API Key",
        re.compile(r"\b(sk-[A-Za-z0-9]{32,}|sk-proj-[A-Za-z0-9_-]{48,}|gsk_[A-Za-z0-9]{40,})\b"),
        "High-privilege LLM API key exposed in repository files. Can be abused for unmetered AI usage.",
        "Revoke the key immediately in your LLM provider dashboard and move to a secure .env file that is ignored by git.",
    ),
    (
        "SEC-001",
        "Exposed Private Encryption Key",
        re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----"),
        "Asymmetric private key found directly in codebase. Compromises encryption, SSH authentication, or signing.",
        "Remove this private key file from version control immediately, rotate affected keypairs, and distribute via a secrets manager.",
    ),
    (
        "SEC-001",
        "Exposed Slack / Webhook Token",
        re.compile(r"\b(xox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,})\b"),
        "Slack integration token discovered. Grants bot or workspace communication rights.",
        "Regenerate token in the Slack API portal and pass via environment variables.",
    ),
]


def shannon_entropy(data: str) -> float:
    if not data:
        return 0.0
    entropy = 0.0
    for x in set(data):
        p_x = float(data.count(x)) / len(data)
        entropy += -p_x * math.log2(p_x)
    return entropy


def is_ignored_file(path: str) -> bool:
    path_norm = str(PurePosixPath(path)).replace("\\", "/")
    cat = classify_file(path_norm)
    if cat in {"build_output", "vendored_dependency", "generated_code", "asset"}:
        return True
    return any(re.search(pat, path_norm, re.IGNORECASE) for pat in IGNORED_PATTERNS)


def is_test_or_sample_file(path: str) -> bool:
    path_norm = str(PurePosixPath(path)).replace("\\", "/")
    cat = classify_file(path_norm)
    if cat == "test":
        return True
    return any(re.search(pat, path_norm, re.IGNORECASE) for pat in TEST_OR_SAMPLE_PATTERNS)


def make_finding_fingerprint(rule_id: str, file_path: str | None, symbol_or_pattern: str) -> str:
    seed = f"{rule_id}:{file_path or 'global'}:{symbol_or_pattern}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def scan_secrets(files: dict[str, str]) -> list[dict]:
    findings = []
    for path, content in files.items():
        if is_ignored_file(path) or is_test_or_sample_file(path):
            continue

        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            line_stripped = line.strip()
            if line_stripped.startswith(("#", "//", "/*", "*")):
                continue

            # Check known high-confidence token formats
            for rule_id, title, pat, why, fix in HIGH_CONFIDENCE_SECRET_PATTERNS:
                m = pat.search(line)
                if m:
                    secret_val = m.group(1) if m.groups() else m.group(0)
                    if secret_val.lower() in DUMMY_SECRET_VALUES:
                        continue
                    masked = secret_val[:4] + "*" * (len(secret_val) - 8) + secret_val[-4:] if len(secret_val) > 12 else "****"
                    evidence_line = line.replace(secret_val, masked).strip()
                    findings.append({
                        "id": make_finding_fingerprint(rule_id, path, f"{line_num}:{title}"),
                        "rule_id": rule_id,
                        "category": "security",
                        "severity": "critical",
                        "confidence": "high",
                        "confidence_classification": "verified",
                        "evidence_type": "pattern_heuristic",
                        "title": title,
                        "description": f"{title} discovered in {path} at line {line_num}.",
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": why,
                        "evidence": evidence_line[:200],
                        "suggested_fix": fix,
                        "recommendation": fix,
                        "root_cause_group": "secret-exposure",
                        "source_reference": {
                            "file_path": path,
                            "start_line": line_num,
                            "end_line": line_num,
                            "symbol": title,
                            "evidence_type": "secret_match",
                        },
                    })

            # Check generic hardcoded high-entropy credentials assigned in code (not in .env)
            if not path.endswith((".env", ".env.local", ".env.production")):
                generic_match = re.search(
                    r"""(?i)\b(api_key|secret_key|private_key|auth_token|access_token|password)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]""",
                    line,
                )
                if generic_match:
                    val = generic_match.group(2)
                    if val.lower() not in DUMMY_SECRET_VALUES and shannon_entropy(val) > 3.2:
                        masked = val[:3] + "*" * (len(val) - 6) + val[-3:] if len(val) > 8 else "****"
                        evidence_line = line.replace(val, masked).strip()
                        findings.append({
                            "id": make_finding_fingerprint("SEC-001", path, f"{line_num}:generic-secret"),
                            "rule_id": "SEC-001",
                            "category": "security",
                            "severity": "critical",
                            "confidence": "strong_evidence",
                            "evidence_type": "pattern_heuristic",
                            "title": "Hardcoded High-Entropy Secret in Code",
                            "description": f"Potential sensitive credential assigned directly in code in {path} at line {line_num}.",
                            "file_path": path,
                            "line": line_num,
                            "why_it_matters": "Credentials stored directly in source code can be leaked through version control, logs, and unauthorized repository access.",
                            "evidence": evidence_line[:200],
                            "suggested_fix": "Extract this secret into an environment variable and load it securely at runtime.",
                            "recommendation": "Extract this secret into an environment variable and load it securely at runtime.",
                            "root_cause_group": "secret-exposure",
                            "source_reference": {
                                "file_path": path,
                                "start_line": line_num,
                                "end_line": line_num,
                                "symbol": "api_key",
                                "evidence_type": "entropy_match",
                            },
                        })
    return findings


class PythonAstSecurityVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str, lines: list[str]):
        self.file_path = file_path
        self.lines = lines
        self.findings: list[dict] = []
        self.current_function: str = ""
        self.loop_depth: int = 0

    def _get_line_snippet(self, lineno: int) -> str:
        if 1 <= lineno <= len(self.lines):
            return self.lines[lineno - 1].strip()[:200]
        return ""

    def visit_Call(self, node: ast.Call):
        func_name = ""
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        # 1. Unsafe Command Execution with shell=True (SEC-002)
        if func_name in {"run", "Popen", "call", "check_call", "check_output"}:
            for kw in node.keywords:
                if kw.arg == "shell":
                    is_true = False
                    if isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        is_true = True
                    if is_true:
                        has_dynamic_command = False
                        if node.args:
                            first_arg = node.args[0]
                            if not isinstance(first_arg, ast.Constant):
                                has_dynamic_command = True
                        severity = "critical" if has_dynamic_command else "high"
                        self.findings.append({
                            "id": make_finding_fingerprint("SEC-002", self.file_path, f"{node.lineno}:{func_name}"),
                            "rule_id": "SEC-002",
                            "category": "security",
                            "severity": severity,
                            "confidence": "high",
                            "confidence_classification": "verified",
                            "evidence_type": "ast_verified",
                            "title": "Command Injection Sink (subprocess with shell=True)",
                            "description": f"Executing system commands with shell=True in {self.file_path} at line {node.lineno}.",
                            "file_path": self.file_path,
                            "line": node.lineno,
                            "why_it_matters": "Using shell=True invokes a system shell interpreter. If any part of the command comes from external or variable input, arbitrary shell commands can be executed.",
                            "evidence": self._get_line_snippet(node.lineno),
                            "suggested_fix": "Set shell=False and pass command and arguments as a validated list: subprocess.run(['cmd', arg1, arg2], shell=False).",
                            "recommendation": "Pass commands and arguments as a validated list with shell=False.",
                            "root_cause_group": "command-injection",
                            "source_reference": {
                                "file_path": self.file_path,
                                "start_line": node.lineno,
                                "end_line": getattr(node, "end_lineno", node.lineno),
                                "symbol": func_name,
                                "evidence_type": "ast_call",
                            },
                        })

        # 2. Insecure Deserialization via pickle (SEC-003)
        if func_name in {"loads", "load"}:
            is_pickle = False
            if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                if node.func.value.id in {"pickle", "_pickle", "cPickle"}:
                    is_pickle = True
            if is_pickle:
                self.findings.append({
                    "id": make_finding_fingerprint("SEC-003", self.file_path, f"{node.lineno}:pickle"),
                    "rule_id": "SEC-003",
                    "category": "security",
                    "severity": "critical",
                    "confidence": "verified",
                    "evidence_type": "ast_verified",
                    "title": "Insecure Deserialization (pickle)",
                    "description": f"Unsafe pickle deserialization in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "Pickle can construct arbitrary Python objects during unpickling, allowing remote code execution if untrusted data is processed.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": "Use safe serialization formats like JSON, MessagePack, or Protocol Buffers instead of pickle.",
                    "recommendation": "Use safe serialization formats like JSON or Protocol Buffers instead of pickle.",
                    "root_cause_group": "insecure-deserialization",
                    "source_reference": {
                        "file_path": self.file_path,
                        "start_line": node.lineno,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "symbol": func_name,
                        "evidence_type": "ast_call",
                    },
                })

        # 3. Dynamic code evaluation (SEC-004)
        if func_name in {"eval", "exec"}:
            if node.args and not isinstance(node.args[0], ast.Constant):
                self.findings.append({
                    "id": make_finding_fingerprint("SEC-004", self.file_path, f"{node.lineno}:{func_name}"),
                    "rule_id": "SEC-004",
                    "category": "security",
                    "severity": "critical",
                    "confidence": "verified",
                    "evidence_type": "ast_verified",
                    "title": f"Dangerous Dynamic Evaluation ({func_name})",
                    "description": f"Dynamic execution of unverified expression using {func_name}() in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "eval() and exec() execute arbitrary Python code in the current scope. An attacker supplying input can achieve full arbitrary code execution.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": "Use ast.literal_eval() for parsing data structures, or map allowed operations to a dictionary of functions.",
                    "recommendation": "Replace dynamic eval/exec with ast.literal_eval or structured dispatch maps.",
                    "root_cause_group": "dynamic-evaluation",
                    "source_reference": {
                        "file_path": self.file_path,
                        "start_line": node.lineno,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "symbol": func_name,
                        "evidence_type": "ast_call",
                    },
                })

        # 4. HTTP client without timeout (REL-001)
        if func_name in {"get", "post", "put", "delete", "patch", "request"}:
            is_http_client = False
            if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                if node.func.value.id in {"requests", "httpx", "http_client", "client"}:
                    is_http_client = True
            if is_http_client:
                has_timeout = any(kw.arg == "timeout" for kw in node.keywords)
                if not has_timeout:
                    self.findings.append({
                        "id": make_finding_fingerprint("REL-001", self.file_path, f"{node.lineno}:{func_name}"),
                        "rule_id": "REL-001",
                        "category": "reliability",
                        "severity": "medium",
                        "confidence": "verified",
                        "evidence_type": "ast_verified",
                        "title": "Unbounded HTTP Request (Missing Timeout)",
                        "description": f"Network request call to .{func_name}() in {self.file_path}:{node.lineno} does not specify an explicit timeout.",
                        "file_path": self.file_path,
                        "line": node.lineno,
                        "why_it_matters": "Without an explicit timeout, requests can wait indefinitely on stalled remote servers, exhausting thread pools and causing cascading service failures.",
                        "evidence": self._get_line_snippet(node.lineno),
                        "suggested_fix": "Add an explicit timeout parameter, e.g.: httpx.get(url, timeout=10.0).",
                        "recommendation": "Configure explicit connect and read timeouts on all HTTP client calls.",
                        "root_cause_group": "missing-timeout",
                        "source_reference": {
                            "file_path": self.file_path,
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                            "symbol": func_name,
                            "evidence_type": "ast_call",
                        },
                    })

        # 5. Disabled TLS verification (SEC-005)
        for kw in node.keywords:
            if kw.arg in {"verify", "rejectUnauthorized"}:
                if isinstance(kw.value, ast.Constant) and kw.value.value is False:
                    self.findings.append({
                        "id": make_finding_fingerprint("SEC-005", self.file_path, f"{node.lineno}:tls-disabled"),
                        "rule_id": "SEC-005",
                        "category": "security",
                        "severity": "high",
                        "confidence": "verified",
                        "evidence_type": "ast_verified",
                        "title": "Disabled TLS Certificate Verification",
                        "description": f"TLS verification explicitly disabled in {self.file_path} at line {node.lineno}.",
                        "file_path": self.file_path,
                        "line": node.lineno,
                        "why_it_matters": "Disabling TLS certificate verification allows Man-In-The-Middle (MITM) attackers to intercept or alter encrypted traffic.",
                        "evidence": self._get_line_snippet(node.lineno),
                        "suggested_fix": "Enable SSL verification (verify=True or use a valid CA bundle path).",
                        "recommendation": "Ensure SSL verification remains enabled across all outbound HTTPS calls.",
                        "root_cause_group": "disabled-tls",
                        "source_reference": {
                            "file_path": self.file_path,
                            "start_line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                            "symbol": "verify",
                            "evidence_type": "ast_kwarg",
                        },
                    })

        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        prev_func = self.current_function
        self.current_function = node.name
        # Mutable default arguments (CORR-001)
        for default in node.args.defaults:
            if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                type_name = "list" if isinstance(default, ast.List) else "dict" if isinstance(default, ast.Dict) else "set"
                self.findings.append({
                    "id": make_finding_fingerprint("CORR-001", self.file_path, f"{node.name}:{type_name}"),
                    "rule_id": "CORR-001",
                    "category": "correctness",
                    "severity": "high",
                    "confidence": "review_recommended",
                    "confidence_classification": "review_recommended",
                    "evidence_type": "ast_confirmed_pattern",
                    "detection_method": "AST-Confirmed Pattern",
                    "title": f"Mutable Default Argument ({type_name}) in Function Definition",
                    "description": f"Function '{node.name}' in {self.file_path} at line {node.lineno} specifies a mutable {type_name} as a default argument.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "Default argument expressions in Python are evaluated once at function definition time, not at each call. Modifications mutate the object for all subsequent invocations.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": f"Set default to None and initialize inside the function: def {node.name}(..., arg=None): if arg is None: arg = []",
                    "recommendation": f"Use None sentinel pattern for function '{node.name}' instead of mutable default.",
                    "when_intentional": "Occasionally used as an intentional memoization accumulator, but using a None sentinel is standard and safer.",
                    "root_cause_group": "mutable-default-arg",
                    "source_reference": {
                        "file_path": self.file_path,
                        "start_line": node.lineno,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "symbol": node.name,
                        "evidence_type": "ast_func_def",
                    },
                })
        self.generic_visit(node)
        self.current_function = prev_func

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        prev_func = self.current_function
        self.current_function = node.name
        self.generic_visit(node)
        self.current_function = prev_func

    def visit_For(self, node: ast.For):
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_AsyncFor(self, node: ast.AsyncFor):
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_While(self, node: ast.While):
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        # Silent exception swallowing (REL-002)
        if len(node.body) == 1 and isinstance(node.body[0], (ast.Pass, ast.Expr)):
            stmt = node.body[0]
            is_silent = False
            if isinstance(stmt, ast.Pass):
                is_silent = True
            elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and stmt.value.value in {..., None, ""}:
                is_silent = True

            if is_silent:
                is_broad = False
                exc_name = ""
                if node.type is None:
                    is_broad = True
                    exc_name = "bare except"
                    exc_display = "bare 'except:'"
                elif isinstance(node.type, ast.Name):
                    exc_name = node.type.id
                    exc_display = f"'except {node.type.id}:'"
                    if node.type.id in {"Exception", "BaseException"}:
                        is_broad = True
                elif isinstance(node.type, ast.Tuple):
                    names = [ast.unparse(elt) for elt in node.type.elts]
                    is_broad = any(n in {"Exception", "BaseException"} for n in names)
                    exc_name = ", ".join(names)
                    exc_display = f"'except ({exc_name}):'"
                else:
                    exc_name = ast.unparse(node.type)
                    exc_display = f"'except {exc_name}:'"
                    if exc_name in {"Exception", "BaseException"}:
                        is_broad = True

                is_critical_func = any(k in self.current_function.lower() for k in ("transaction", "commit", "payment", "payout", "transfer", "authenticate", "authorize", "grant_token"))
                in_loop = self.loop_depth > 0

                if is_broad:
                    severity = "high" if is_critical_func else "medium"
                    title = "Broad Silent Exception Swallowing (Blank pass)"
                    why = (
                        f"In a critical or security-sensitive function ('{self.current_function}'), catching broad exceptions silently without re-raising can conceal critical failures or rollback states, leaving system state inconsistent."
                        if is_critical_func
                        else "A broad catch block ('except Exception:' or bare 'except:') intercepts all runtime errors including syntax/type errors, network timeouts, and programming bugs. Suppressing it without inspection makes debugging difficult and conceals unexpected failures."
                    )
                    fix = "Catch specific expected exception types instead of broad Exception. If the exception must be suppressed, log diagnostic details using logger.warning() or logger.exception()."
                    when = "Broad suppression is rarely recommended outside top-level daemon loops or safety wrappers where crashing the host process must be prevented."
                    root_cause = "broad-silent-exception"
                else:
                    severity = "low"
                    title = f"Silent Exception Suppression ({exc_name})"
                    why = f"Catching {exc_display} and suppressing with blank pass discards the error. While common for fallback probing or optional lookup, it can obscure underlying issues if assumptions change."
                    fix = f"Verify that swallowing {exc_name} is deliberate. If this represents expected fallback or optional lookup, consider using contextlib.suppress({exc_name}) or adding an inline comment to clarify developer intent."
                    when = f"Catching {exc_name} and passing is commonly intentional for optional dictionary key access, checking file existence, graceful generator termination, or iterating through fallback candidates."
                    root_cause = "narrow-silent-exception"

                self.findings.append({
                    "id": make_finding_fingerprint("REL-002", self.file_path, f"{node.lineno}:{root_cause}"),
                    "rule_id": "REL-002",
                    "category": "reliability",
                    "severity": severity,
                    "confidence": "review_recommended",
                    "confidence_classification": "review_recommended",
                    "evidence_type": "ast_confirmed_pattern",
                    "detection_method": "AST-Confirmed Pattern",
                    "title": title,
                    "description": f"Unhandled exception block with {exc_display} silently suppressed with blank pass in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": why,
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": fix,
                    "recommendation": fix,
                    "when_intentional": when,
                    "root_cause_group": root_cause,
                    "source_reference": {
                        "file_path": self.file_path,
                        "start_line": node.lineno,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "symbol": exc_name,
                        "evidence_type": "ast_except",
                    },
                })
        self.generic_visit(node)


def scan_python_ast(files: dict[str, str]) -> list[dict]:
    findings = []
    for path, content in files.items():
        if not path.endswith(".py") or is_ignored_file(path) or is_test_or_sample_file(path):
            continue
        try:
            tree = ast.parse(content, filename=path)
            lines = content.splitlines()
            visitor = PythonAstSecurityVisitor(path, lines)
            visitor.visit(tree)
            findings.extend(visitor.findings)
        except SyntaxError:
            continue
    return findings


def scan_javascript_typescript(files: dict[str, str]) -> list[dict]:
    findings = []
    for path, content in files.items():
        suffix = PurePosixPath(path).suffix.lower()
        if suffix not in {".js", ".jsx", ".ts", ".tsx", ".mjs"} or is_ignored_file(path) or is_test_or_sample_file(path):
            continue

        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            line_stripped = line.strip()
            if line_stripped.startswith(("//", "/*", "*")):
                continue

            # 1. dangerouslySetInnerHTML (SEC-006)
            if "dangerouslySetInnerHTML" in line:
                if not re.search(r"DOMPurify\.sanitize", line):
                    findings.append({
                        "id": make_finding_fingerprint("SEC-006", path, f"{line_num}:xss"),
                        "rule_id": "SEC-006",
                        "category": "security",
                        "severity": "high",
                        "confidence": "high",
                        "confidence_classification": "verified",
                        "evidence_type": "pattern_heuristic",
                        "title": "Unsanitized dangerouslySetInnerHTML (XSS Risk)",
                        "description": f"Raw HTML injection detected in {path} at line {line_num}.",
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": "Rendering raw unescaped HTML directly bypasses React's built-in XSS protection and allows stored or reflected cross-site scripting.",
                        "evidence": line_stripped[:200],
                        "suggested_fix": "Sanitize HTML using DOMPurify before injection, or render structured React components instead.",
                        "recommendation": "Sanitize injected HTML using DOMPurify or convert to standard React components.",
                        "root_cause_group": "xss-risk",
                        "source_reference": {
                            "file_path": path,
                            "start_line": line_num,
                            "end_line": line_num,
                            "symbol": "dangerouslySetInnerHTML",
                            "evidence_type": "jsx_prop",
                        },
                    })

            # 2. Dangerous eval / Function constructor (SEC-004)
            if re.search(r"\b(?:eval|new\s+Function)\s*\(", line):
                findings.append({
                    "id": make_finding_fingerprint("SEC-004", path, f"{line_num}:eval"),
                    "rule_id": "SEC-004",
                    "category": "security",
                    "severity": "high",
                    "confidence": "strong_evidence",
                    "evidence_type": "pattern_heuristic",
                    "title": "Arbitrary JavaScript Code Execution (eval)",
                    "description": f"Dynamic JavaScript evaluation sink in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Evaluating strings as JavaScript code can lead to remote code execution and prototype pollution.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Refactor to use explicit JSON.parse or structured dispatch tables.",
                    "recommendation": "Replace dynamic eval() with structured parsing or explicit handler tables.",
                    "root_cause_group": "dynamic-evaluation",
                    "source_reference": {
                        "file_path": path,
                        "start_line": line_num,
                        "end_line": line_num,
                        "symbol": "eval",
                        "evidence_type": "js_eval",
                    },
                })

            # 3. Disabled SSL (SEC-005)
            if "NODE_TLS_REJECT_UNAUTHORIZED" in line and ("0" in line or "'0'" in line or '"0"' in line):
                findings.append({
                    "id": make_finding_fingerprint("SEC-005", path, f"{line_num}:tls-reject-0"),
                    "rule_id": "SEC-005",
                    "category": "security",
                    "severity": "high",
                    "confidence": "verified",
                    "evidence_type": "pattern_heuristic",
                    "title": "Disabled Node.js TLS Certificate Verification",
                    "description": f"NODE_TLS_REJECT_UNAUTHORIZED set to 0 in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Disables global SSL/TLS certificate validation across all Node.js HTTPS requests, permitting MITM attacks.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Remove NODE_TLS_REJECT_UNAUTHORIZED='0' and configure valid root CA certificates.",
                    "recommendation": "Remove NODE_TLS_REJECT_UNAUTHORIZED='0' and maintain TLS certificate validation.",
                    "root_cause_group": "disabled-tls",
                    "source_reference": {
                        "file_path": path,
                        "start_line": line_num,
                        "end_line": line_num,
                        "symbol": "NODE_TLS_REJECT_UNAUTHORIZED",
                        "evidence_type": "env_override",
                    },
                })

            # 4. child_process.exec with template literals (SEC-002)
            if re.search(r"child_process\s*\.\s*exec\s*\(\s*`[^`]*\${", line) or re.search(r"\bexec\s*\(\s*`[^`]*\${", line):
                findings.append({
                    "id": make_finding_fingerprint("SEC-002", path, f"{line_num}:js-exec"),
                    "rule_id": "SEC-002",
                    "category": "security",
                    "severity": "critical",
                    "confidence": "verified",
                    "evidence_type": "pattern_heuristic",
                    "title": "Command Injection Risk in child_process.exec",
                    "description": f"String interpolation in child_process.exec call in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Using template literals with variables in exec passes unsanitized input to the OS shell.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Use child_process.execFile() or spawn() with argument arrays instead of shell command strings.",
                    "recommendation": "Use child_process.execFile or spawn with argument arrays instead of shell interpolation.",
                    "root_cause_group": "command-injection",
                    "source_reference": {
                        "file_path": path,
                        "start_line": line_num,
                        "end_line": line_num,
                        "symbol": "exec",
                        "evidence_type": "js_exec",
                    },
                })
    return findings


def scan_low_priority_markers(files: dict[str, str]) -> list[dict]:
    low_findings = []
    todo_re = re.compile(r"(?i)\b(TODO|FIXME|HACK|XXX)\b\s*[:\-]?\s*(.*)")
    for path, content in files.items():
        if is_ignored_file(path) or is_test_or_sample_file(path):
            continue
        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            line_stripped = line.strip()
            if line_stripped.startswith(("#", "//", "/*", "*")):
                m = todo_re.search(line_stripped)
                if m:
                    marker_type = m.group(1).upper()
                    comment_text = m.group(2).strip()[:100]
                    low_findings.append({
                        "id": make_finding_fingerprint("MAINT-002", path, f"{line_num}:{marker_type}"),
                        "rule_id": "MAINT-002",
                        "category": "maintainability",
                        "severity": "low",
                        "confidence": "strong_evidence",
                        "evidence_type": "pattern_heuristic",
                        "title": f"Unresolved {marker_type} Marker",
                        "description": f"Pending technical debt marker in {path}:{line_num}" + (f": {comment_text}" if comment_text else ""),
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": "TODO and FIXME comments represent deferred work or unfinished edge cases that can accumulate into technical debt.",
                        "evidence": line_stripped[:160],
                        "suggested_fix": "Resolve the task or convert it into a tracked issue in your project backlog.",
                        "recommendation": "Track or resolve deferred implementation marker.",
                        "root_cause_group": "code-marker",
                        "source_reference": {
                            "file_path": path,
                            "start_line": line_num,
                            "end_line": line_num,
                            "symbol": marker_type,
                            "evidence_type": "comment_marker",
                        },
                    })
                    if len(low_findings) >= 20:
                        return low_findings
    return low_findings


def deduplicate_and_group(findings: list[dict]) -> list[dict]:
    """
    Deduplicate identical findings by stable fingerprint key while preserving distinct occurrences.
    """
    seen = set()
    result = []
    for f in findings:
        # Deduplication key based on rule, file path, line, and title
        key = (f.get("rule_id"), f.get("file_path"), f.get("line"), f.get("title"))
        if key in seen:
            continue
        seen.add(key)
        f.setdefault("id", make_finding_fingerprint(f.get("rule_id", "GEN-001"), f.get("file_path"), str(f.get("line"))))
        f.setdefault("confidence", "verified")
        f.setdefault("evidence_type", "ast_verified")
        f.setdefault("detection_method", "AST-Confirmed Pattern" if "ast" in f.get("evidence_type", "") else "Heuristic Detection")
        f.setdefault("why_it_matters", "Potential defect or security risk detected by static code analysis.")
        f.setdefault("evidence", "")
        f.setdefault("suggested_fix", "Review the flagged code and apply defensive programming practices.")
        f.setdefault("recommendation", f.get("suggested_fix", ""))
        f.setdefault("when_intentional", "")
        f.setdefault("root_cause_group", "general")
        result.append(f)
    return result


def detect_findings(files: dict[str, str]) -> list[dict]:
    """
    Codebase Doctor diagnostic engine:
    Detects evidence-backed Critical, High, and Medium issues using AST and high-confidence checks.
    Separates Low issues (TODOs) so the UI can filter them out by default.
    """
    all_findings: list[dict] = []

    # 1. High-confidence secrets
    all_findings.extend(scan_secrets(files))

    # 2. Python AST security & correctness checks
    all_findings.extend(scan_python_ast(files))

    # 3. JavaScript / TypeScript security checks
    all_findings.extend(scan_javascript_typescript(files))

    # 4. Check for missing README (MAINT-001)
    has_readme = any(re.match(r"^README(?:\.[a-z]+)?$", PurePosixPath(p).name, re.I) for p in files)
    if not has_readme:
        all_findings.append({
            "id": make_finding_fingerprint("MAINT-001", "root", "missing-readme"),
            "rule_id": "MAINT-001",
            "category": "maintainability",
            "severity": "medium",
            "confidence": "verified",
            "evidence_type": "pattern_heuristic",
            "title": "Missing Repository Documentation (README)",
            "description": "No top-level README file was detected in the repository.",
            "file_path": None,
            "line": None,
            "why_it_matters": "A README is critical for developer onboarding, setup verification, and architectural clarity.",
            "evidence": "Repository root contains no README.md or equivalent documentation file.",
            "suggested_fix": "Add a comprehensive README.md covering project overview, setup steps, environment variables, and usage.",
            "recommendation": "Add a structured README.md covering project overview, installation, and environment configuration.",
            "root_cause_group": "missing-documentation",
            "source_reference": {
                "file_path": "README.md",
                "start_line": 1,
                "end_line": 1,
                "symbol": "README",
                "evidence_type": "missing_file",
            },
        })

    # 5. Low-priority markers (TODO / FIXME)
    all_findings.extend(scan_low_priority_markers(files))

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    deduped = deduplicate_and_group(all_findings)
    deduped.sort(key=lambda x: (severity_order.get(x.get("severity", "low"), 4), x.get("file_path") or ""))

    return deduped[:120]
