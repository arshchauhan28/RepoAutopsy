import re
from collections import Counter

PATTERNS = [
    ("security", "critical", "Potential secret in source", re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{12,}['\"]"), "Move secrets to environment variables or a secret manager."),
    ("security", "high", "Potential command injection sink", re.compile(r"(?i)subprocess\.(run|Popen|call)\([^\n]*shell\s*=\s*True"), "Avoid shell=True and pass arguments as a list after validating input."),
    ("security", "medium", "Unsafe dynamic evaluation", re.compile(r"\b(eval|exec)\s*\("), "Avoid dynamic evaluation of untrusted strings; use explicit parsing instead."),
    ("quality", "medium", "Very long function", re.compile(r"(?s)(?:def|function|func)\s+[A-Za-z_]\w*.*?(?=\n(?:def|class|function|func)\s|\Z)"), "Split large functions into smaller units with focused responsibilities."),
    ("quality", "low", "TODO/FIXME marker", re.compile(r"(?i)\b(TODO|FIXME|HACK)\b"), "Turn the marker into a tracked issue or resolve it before production."),
    ("documentation", "low", "Missing obvious project documentation", re.compile(r"^$"), "Consider adding a clear README with setup, architecture, environment variables and usage."),
]


def detect_findings(files: dict[str, str]) -> list[dict]:
    findings = []
    for path, content in files.items():
        if path.lower().endswith((".min.js", ".map", ".lock")):
            continue
        for category, severity, title, pattern, recommendation in PATTERNS:
            if title == "Missing obvious project documentation":
                continue
            matches = list(pattern.finditer(content))
            if title == "Very long function":
                for match in matches:
                    line_count = match.group(0).count("\n")
                    if line_count < 80:
                        continue
                    findings.append({"category": category, "severity": severity, "title": title, "description": f"A function-like block in {path} spans about {line_count} lines.", "file_path": path, "line": content[:match.start()].count("\n") + 1, "recommendation": recommendation})
                    if len(findings) >= 80:
                        return findings
            else:
                for match in matches[:5]:
                    findings.append({"category": category, "severity": severity, "title": title, "description": f"Pattern detected in {path}: {match.group(0)[:160]}", "file_path": path, "line": content[:match.start()].count("\n") + 1, "recommendation": recommendation})
                    if len(findings) >= 80:
                        return findings

    readme_exists = any(p.lower() in {"readme.md", "readme.txt", "readme"} for p in files)
    if not readme_exists:
        findings.append({"category": "documentation", "severity": "medium", "title": "README is missing", "description": "The repository does not contain an obvious README file.", "file_path": None, "line": None, "recommendation": "Add setup instructions, architecture, environment variables, usage and contribution guidance."})
    return findings
