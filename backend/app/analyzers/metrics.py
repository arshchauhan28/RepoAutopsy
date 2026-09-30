import hashlib
import re
from collections import Counter
from pathlib import PurePosixPath

EXT_LANG = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript",
    ".java": "Java", ".go": "Go", ".rs": "Rust", ".cpp": "C++", ".cc": "C++", ".c": "C",
    ".cs": "C#", ".php": "PHP", ".rb": "Ruby", ".kt": "Kotlin", ".swift": "Swift",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".sql": "SQL", ".sh": "Shell", ".yml": "YAML", ".yaml": "YAML", ".json": "JSON",
}
IGNORED_DIRS = {"node_modules", ".git", "dist", "build", ".next", "coverage", "venv", ".venv", "__pycache__"}


def language_for(path: str) -> str:
    return EXT_LANG.get(PurePosixPath(path).suffix.lower(), "Other")


def analyze_metrics(files: dict[str, str]) -> dict:
    languages = Counter()
    total_lines = 0
    total_code_lines = 0
    total_files = 0
    largest = []
    function_count = 0
    class_count = 0
    hashes = {}

    for path, content in files.items():
        if any(part in IGNORED_DIRS for part in PurePosixPath(path).parts):
            continue
        total_files += 1
        lang = language_for(path)
        languages[lang] += 1
        lines = content.count("\n") + (1 if content else 0)
        code_lines = sum(1 for line in content.splitlines() if line.strip() and not line.strip().startswith(("#", "//", "/*", "*")))
        total_lines += lines
        total_code_lines += code_lines
        largest.append((lines, path))
        function_count += len(re.findall(r"\b(?:def|function|func)\s+[A-Za-z_][\w]*", content))
        class_count += len(re.findall(r"\bclass\s+[A-Za-z_][\w]*", content))
        normalized = "\n".join(line.strip() for line in content.splitlines() if line.strip())
        if len(normalized) >= 120:
            hashes.setdefault(hashlib.sha1(normalized.encode()).hexdigest(), []).append(path)

    duplicates = [paths for paths in hashes.values() if len(paths) > 1]
    return {
        "total_files": total_files,
        "total_lines": total_lines,
        "code_lines": total_code_lines,
        "languages": dict(languages.most_common()),
        "functions": function_count,
        "classes": class_count,
        "largest_files": [{"path": p, "lines": n} for n, p in sorted(largest, reverse=True)[:8]],
        "duplicate_groups": duplicates[:10],
    }
