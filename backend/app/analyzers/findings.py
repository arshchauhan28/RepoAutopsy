from __future__ import annotations

import ast
import math
import re
from pathlib import PurePosixPath

# Files to completely ignore during security & quality scanning
IGNORED_PATTERNS = [
    r"\.min\.(?:js|css)$",
    r"\.bundle\.(?:js|css)$",
    r"\.map$",
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"pnpm-lock\.yaml$",
    r"\.svg$",
    r"node_modules/",
    r"\.git/",
    r"dist/",
    r"build/",
    r"\.next/",
    r"__pycache__/",
    r"\.venv/",
]

# Files where credentials / mocks are expected and should NOT trigger secret alerts
TEST_OR_SAMPLE_PATTERNS = [
    r"(?:^|/)(?:tests?|__tests__|spec|fixtures|mocks|examples|testdata|stubs)(?:/|$)",
    r"(?:test_[^/]+\.py|.*\.test\.[a-z]+|.*\.spec\.[a-z]+)$",
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

# Regex secret detectors with known high-entropy prefixes
HIGH_CONFIDENCE_SECRET_PATTERNS = [
    (
        "Exposed AWS Access Key",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "Critical cloud credential exposed in source code. Allows direct access to AWS resources.",
        "Immediately revoke this key in the AWS IAM Console, rotate credentials, and load from environment variables (AWS_ACCESS_KEY_ID).",
    ),
    (
        "Exposed GitHub Personal Access Token",
        re.compile(r"\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"),
        "Personal access token with GitHub API privileges is committed to source control.",
        "Revoke the token in GitHub Settings -> Developer settings -> Personal access tokens, and inject via environment variables or GitHub Actions Secrets.",
    ),
    (
        "Exposed OpenAI / Groq API Key",
        re.compile(r"\b(sk-[A-Za-z0-9]{32,}|sk-proj-[A-Za-z0-9_-]{48,}|gsk_[A-Za-z0-9]{40,})\b"),
        "High-privilege LLM API key exposed in repository files. Can be abused for unmetered AI usage.",
        "Revoke the key immediately in your LLM provider dashboard and move to a secure .env file that is ignored by git.",
    ),
    (
        "Exposed Private Encryption Key",
        re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE KEY-----"),
        "Asymmetric private key found directly in codebase. Compromises encryption, SSH authentication, or signing.",
        "Remove this private key file from version control immediately, rotate affected keypairs, and distribute via a secrets manager.",
    ),
    (
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
    return any(re.search(pat, path_norm, re.IGNORECASE) for pat in IGNORED_PATTERNS)


def is_test_or_sample_file(path: str) -> bool:
    path_norm = str(PurePosixPath(path)).replace("\\", "/")
    return any(re.search(pat, path_norm, re.IGNORECASE) for pat in TEST_OR_SAMPLE_PATTERNS)


def scan_secrets(files: dict[str, str]) -> list[dict]:
    findings = []
    for path, content in files.items():
        if is_ignored_file(path) or is_test_or_sample_file(path):
            continue

        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            line_stripped = line.strip()
            # Ignore comment lines
            if line_stripped.startswith(("#", "//", "/*", "*")):
                continue

            # Check known high-confidence token formats
            for title, pat, why, fix in HIGH_CONFIDENCE_SECRET_PATTERNS:
                m = pat.search(line)
                if m:
                    secret_val = m.group(1) if m.groups() else m.group(0)
                    if secret_val.lower() in DUMMY_SECRET_VALUES:
                        continue
                    # Obfuscate secret in evidence
                    masked = secret_val[:4] + "*" * (len(secret_val) - 8) + secret_val[-4:] if len(secret_val) > 12 else "****"
                    evidence_line = line.replace(secret_val, masked).strip()
                    findings.append({
                        "category": "security",
                        "severity": "critical",
                        "confidence": "high",
                        "title": title,
                        "description": f"{title} discovered in {path} at line {line_num}.",
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": why,
                        "evidence": evidence_line[:200],
                        "suggested_fix": fix,
                        "root_cause_group": "secret-exposure",
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
                            "category": "security",
                            "severity": "critical",
                            "confidence": "high",
                            "title": "Hardcoded High-Entropy Secret in Code",
                            "description": f"Potential sensitive credential assigned directly in code in {path} at line {line_num}.",
                            "file_path": path,
                            "line": line_num,
                            "why_it_matters": "Credentials stored directly in source code can be leaked through version control, logs, and unauthorized repository access.",
                            "evidence": evidence_line[:200],
                            "suggested_fix": "Extract this secret into an environment variable and load it securely at runtime.",
                            "root_cause_group": "secret-exposure",
                        })
    return findings


class PythonAstSecurityVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str, lines: list[str]):
        self.file_path = file_path
        self.lines = lines
        self.findings: list[dict] = []

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

        # 1. Unsafe Command Execution with shell=True
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
                            "category": "security",
                            "severity": severity,
                            "confidence": "high",
                            "title": "Command Injection Sink (subprocess with shell=True)",
                            "description": f"Executing system commands with shell=True in {self.file_path} at line {node.lineno}.",
                            "file_path": self.file_path,
                            "line": node.lineno,
                            "why_it_matters": "Using shell=True invokes a system shell interpreter. If any part of the command comes from external or variable input, arbitrary shell commands can be executed.",
                            "evidence": self._get_line_snippet(node.lineno),
                            "suggested_fix": "Set shell=False and pass command and arguments as a validated list: subprocess.run(['cmd', arg1, arg2], shell=False).",
                            "root_cause_group": "command-injection",
                        })

        # 2. Insecure Deserialization (pickle)
        if func_name in {"loads", "load"}:
            is_pickle = False
            if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                if node.func.value.id in {"pickle", "_pickle", "cPickle"}:
                    is_pickle = True
            if is_pickle:
                self.findings.append({
                    "category": "security",
                    "severity": "critical",
                    "confidence": "high",
                    "title": "Insecure Deserialization (pickle)",
                    "description": f"Unsafe pickle deserialization in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "Pickle can construct arbitrary Python objects during unpickling, allowing remote code execution if untrusted data is processed.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": "Use safe serialization formats like JSON, MessagePack, or Protocol Buffers instead of pickle.",
                    "root_cause_group": "insecure-deserialization",
                })

        # 3. Dynamic code evaluation (eval / exec)
        if func_name in {"eval", "exec"}:
            if node.args and not isinstance(node.args[0], ast.Constant):
                self.findings.append({
                    "category": "security",
                    "severity": "critical",
                    "confidence": "high",
                    "title": f"Dangerous Dynamic Evaluation ({func_name})",
                    "description": f"Dynamic execution of unverified expression using {func_name}() in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "eval() and exec() execute arbitrary Python code in the current scope. An attacker supplying input can achieve full arbitrary code execution.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": "Use ast.literal_eval() for parsing data structures, or map allowed operations to a dictionary of functions.",
                    "root_cause_group": "dynamic-evaluation",
                })

        # 4. HTTP client without timeout
        if func_name in {"get", "post", "put", "delete", "patch", "request"}:
            is_http_client = False
            if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                if node.func.value.id in {"requests", "httpx", "http_client", "client"}:
                    is_http_client = True
            if is_http_client:
                has_timeout = any(kw.arg == "timeout" for kw in node.keywords)
                if not has_timeout:
                    self.findings.append({
                        "category": "reliability",
                        "severity": "medium",
                        "confidence": "high",
                        "title": "Unbounded HTTP Request (Missing Timeout)",
                        "description": f"Network request call to .{func_name}() in {self.file_path}:{node.lineno} does not specify an explicit timeout.",
                        "file_path": self.file_path,
                        "line": node.lineno,
                        "why_it_matters": "Without an explicit timeout, requests can wait indefinitely on stalled remote servers, exhausting thread pools and causing cascading service failures.",
                        "evidence": self._get_line_snippet(node.lineno),
                        "suggested_fix": "Add an explicit timeout parameter, e.g.: httpx.get(url, timeout=10.0).",
                        "root_cause_group": "missing-timeout",
                    })

        # 5. Disabled TLS verification
        for kw in node.keywords:
            if kw.arg in {"verify", "rejectUnauthorized"}:
                if isinstance(kw.value, ast.Constant) and kw.value.value is False:
                    self.findings.append({
                        "category": "security",
                        "severity": "high",
                        "confidence": "high",
                        "title": "Disabled TLS Certificate Verification",
                        "description": f"TLS verification explicitly disabled in {self.file_path} at line {node.lineno}.",
                        "file_path": self.file_path,
                        "line": node.lineno,
                        "why_it_matters": "Disabling TLS certificate verification allows Man-In-The-Middle (MITM) attackers to intercept or alter encrypted traffic.",
                        "evidence": self._get_line_snippet(node.lineno),
                        "suggested_fix": "Enable SSL verification (verify=True or use a valid CA bundle path).",
                        "root_cause_group": "disabled-tls",
                    })

        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        # Mutable default arguments: def foo(bar=[]):
        for default in node.args.defaults:
            if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                type_name = "list" if isinstance(default, ast.List) else "dict" if isinstance(default, ast.Dict) else "set"
                self.findings.append({
                    "category": "correctness",
                    "severity": "high",
                    "confidence": "high",
                    "title": f"Mutable Default Argument ({type_name}) in Function Definition",
                    "description": f"Function '{node.name}' in {self.file_path} at line {node.lineno} specifies a mutable {type_name} as a default argument.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "Default argument expressions in Python are evaluated once at function definition time, not at each call. Modifications mutate the object for all subsequent invocations.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": f"Set default to None and initialize inside the function: def {node.name}(..., arg=None): if arg is None: arg = []",
                    "root_cause_group": "mutable-default-arg",
                })
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        # Silent exception swallowing: except: pass or except Exception: pass
        if len(node.body) == 1 and isinstance(node.body[0], (ast.Pass, ast.Expr)):
            stmt = node.body[0]
            is_silent = False
            if isinstance(stmt, ast.Pass):
                is_silent = True
            elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and stmt.value.value in {..., None, ""}:
                is_silent = True

            if is_silent:
                exc_type = "bare 'except:'" if node.type is None else f"'except {ast.unparse(node.type)}:'"
                self.findings.append({
                    "category": "reliability",
                    "severity": "medium",
                    "confidence": "high",
                    "title": "Silent Exception Swallowing (Blank pass)",
                    "description": f"Unhandled exception block with {exc_type} silently suppressed in {self.file_path} at line {node.lineno}.",
                    "file_path": self.file_path,
                    "line": node.lineno,
                    "why_it_matters": "Silently swallowing exceptions masks critical runtime bugs, database connection failures, and programming errors, making debugging difficult.",
                    "evidence": self._get_line_snippet(node.lineno),
                    "suggested_fix": "Log the exception with details (e.g. logger.exception) or handle specific known exception classes.",
                    "root_cause_group": "silent-exception",
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

            # 1. dangerouslySetInnerHTML
            if "dangerouslySetInnerHTML" in line:
                if not re.search(r"DOMPurify\.sanitize", line):
                    findings.append({
                        "category": "security",
                        "severity": "high",
                        "confidence": "high",
                        "title": "Unsanitized dangerouslySetInnerHTML (XSS Risk)",
                        "description": f"Raw HTML injection detected in {path} at line {line_num}.",
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": "Rendering raw unescaped HTML directly bypasses React's built-in XSS protection and allows stored or reflected cross-site scripting.",
                        "evidence": line_stripped[:200],
                        "suggested_fix": "Sanitize HTML using DOMPurify before injection, or render structured React components instead.",
                        "root_cause_group": "xss-risk",
                    })

            # 2. Dangerous eval / Function constructor
            if re.search(r"\b(?:eval|new\s+Function)\s*\(", line):
                findings.append({
                    "category": "security",
                    "severity": "high",
                    "confidence": "high",
                    "title": "Arbitrary JavaScript Code Execution (eval)",
                    "description": f"Dynamic JavaScript evaluation sink in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Evaluating strings as JavaScript code can lead to remote code execution and prototype pollution.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Refactor to use explicit JSON.parse or structured dispatch tables.",
                    "root_cause_group": "dynamic-evaluation",
                })

            # 3. Disabled SSL
            if "NODE_TLS_REJECT_UNAUTHORIZED" in line and ("0" in line or "'0'" in line or '"0"' in line):
                findings.append({
                    "category": "security",
                    "severity": "high",
                    "confidence": "high",
                    "title": "Disabled Node.js TLS Certificate Verification",
                    "description": f"NODE_TLS_REJECT_UNAUTHORIZED set to 0 in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Disables global SSL/TLS certificate validation across all Node.js HTTPS requests, permitting MITM attacks.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Remove NODE_TLS_REJECT_UNAUTHORIZED='0' and configure valid root CA certificates.",
                    "root_cause_group": "disabled-tls",
                })

            # 4. child_process.exec with template literals
            if re.search(r"child_process\s*\.\s*exec\s*\(\s*`[^`]*\${", line) or re.search(r"\bexec\s*\(\s*`[^`]*\${", line):
                findings.append({
                    "category": "security",
                    "severity": "critical",
                    "confidence": "high",
                    "title": "Command Injection Risk in child_process.exec",
                    "description": f"String interpolation in child_process.exec call in {path} at line {line_num}.",
                    "file_path": path,
                    "line": line_num,
                    "why_it_matters": "Using template literals with variables in exec passes unsanitized input to the OS shell.",
                    "evidence": line_stripped[:200],
                    "suggested_fix": "Use child_process.execFile() or spawn() with argument arrays instead of shell command strings.",
                    "root_cause_group": "command-injection",
                })
    return findings


def scan_low_priority_markers(files: dict[str, str]) -> list[dict]:
    """
    Collect low-priority markers (TODO/FIXME/HACK).
    Note: These are categorized as 'low' so they are hidden by default!
    """
    low_findings = []
    todo_re = re.compile(r"(?i)\b(TODO|FIXME|HACK|XXX)\b\s*[:\-]?\s*(.*)")
    for path, content in files.items():
        if is_ignored_file(path) or is_test_or_sample_file(path):
            continue
        lines = content.splitlines()
        for line_num, line in enumerate(lines, start=1):
            line_stripped = line.strip()
            # Only check in comments
            if line_stripped.startswith(("#", "//", "/*", "*")):
                m = todo_re.search(line_stripped)
                if m:
                    marker_type = m.group(1).upper()
                    comment_text = m.group(2).strip()[:100]
                    low_findings.append({
                        "category": "maintainability",
                        "severity": "low",
                        "confidence": "medium",
                        "title": f"Unresolved {marker_type} Marker",
                        "description": f"Pending technical debt marker in {path}:{line_num}" + (f": {comment_text}" if comment_text else ""),
                        "file_path": path,
                        "line": line_num,
                        "why_it_matters": "TODO and FIXME comments represent deferred work or unfinished edge cases that can accumulate into technical debt.",
                        "evidence": line_stripped[:160],
                        "suggested_fix": "Resolve the task or convert it into a tracked issue in your project backlog.",
                        "root_cause_group": "code-marker",
                    })
                    if len(low_findings) >= 20:
                        return low_findings
    return low_findings


def deduplicate_and_group(findings: list[dict]) -> list[dict]:
    """
    Deduplicate identical findings and assign stable IDs.
    """
    seen = set()
    result = []
    for f in findings:
        key = (f.get("file_path"), f.get("line"), f.get("title"))
        if key in seen:
            continue
        seen.add(key)
        # Ensure all required fields exist
        f.setdefault("confidence", "high")
        f.setdefault("why_it_matters", "Potential risk detected by static code analysis.")
        f.setdefault("evidence", "")
        f.setdefault("suggested_fix", "Review the flagged code and apply defensive programming practices.")
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

    # 4. Check for missing README (Medium severity documentation finding)
    has_readme = any(re.match(r"^README(?:\.[a-z]+)?$", PurePosixPath(p).name, re.I) for p in files)
    if not has_readme:
        all_findings.append({
            "category": "maintainability",
            "severity": "medium",
            "confidence": "high",
            "title": "Missing Repository Documentation (README)",
            "description": "No top-level README file was detected in the repository.",
            "file_path": None,
            "line": None,
            "why_it_matters": "A README is critical for developer onboarding, setup verification, and architectural clarity.",
            "evidence": "Repository root contains no README.md or equivalent documentation file.",
            "suggested_fix": "Add a comprehensive README.md covering project overview, setup steps, environment variables, and usage.",
            "root_cause_group": "missing-documentation",
        })

    # 5. Low-priority markers (TODO / FIXME)
    all_findings.extend(scan_low_priority_markers(files))

    # Deduplicate and sort by severity order: Critical -> High -> Medium -> Low
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    deduped = deduplicate_and_group(all_findings)
    deduped.sort(key=lambda x: (severity_order.get(x.get("severity", "low"), 4), x.get("file_path") or ""))

    return deduped[:120]
