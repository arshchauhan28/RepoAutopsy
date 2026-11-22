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

LOCKFILE_NAMES = {
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "cargo.lock", "gemfile.lock", "composer.lock", "mix.lock", "pipfile.lock",
    "flake.lock", "pubspec.lock", "packages.lock.json", "podfile.lock",
}

GENERATED_OR_DATA_EXTENSIONS = {
    ".min.js", ".min.css", ".map", ".bundle.js", ".bundle.css",
    ".chunk.js", ".chunk.css", ".d.ts", ".db", ".sqlite", ".sqlite3",
    ".bin", ".wasm",
}

GENERATED_DIR_PARTS = {
    "node_modules", "dist", "build", ".next", "out", "vendor",
    "coverage", "__pycache__", ".venv", "target", ".cache",
}

CONFIGURATION_NAMES = {
    "package.json", "tsconfig.json", "pyproject.toml", "setup.cfg", "pom.xml",
    "build.gradle", "docker-compose.yml", "docker-compose.yaml", "dockerfile",
    ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
    ".prettierrc", ".gitignore", "requirements.txt", ".editorconfig",
}

SOURCE_CODE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs",
    ".cpp", ".cc", ".c", ".cs", ".php", ".rb", ".kt", ".swift",
    ".sql", ".sh",
}


GENERATED_FILE_NAMES = {
    "bundle.js", "vendor.js", "main.bundle.js", "runtime.js",
}


def is_lockfile(path: str) -> bool:
    name = PurePosixPath(path).name.lower()
    if name in LOCKFILE_NAMES:
        return True
    return name.endswith(".lock") or name.endswith(".lock.json") or name.endswith(".lock.yaml")


def is_generated_or_data_file(path: str) -> bool:
    name = PurePosixPath(path).name.lower()
    if is_lockfile(path):
        return True
    if name in GENERATED_FILE_NAMES:
        return True
    parts = set(PurePosixPath(path).parts)
    if any(p.lower() in GENERATED_DIR_PARTS for p in parts):
        return True
    if ".min." in name or ".bundle." in name or ".chunk." in name or name.startswith("bundle."):
        return True
    return any(name.endswith(ext) for ext in GENERATED_OR_DATA_EXTENSIONS)


def is_configuration_file(path: str) -> bool:
    name = PurePosixPath(path).name.lower()
    if name in CONFIGURATION_NAMES:
        return True
    suffix = PurePosixPath(path).suffix.lower()
    return suffix in {".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml"}


def is_test_or_fixture_file(path: str) -> bool:
    path_lower = str(PurePosixPath(path)).lower()
    return bool(re.search(r"(?:^|/)(?:tests?|__tests__|spec|fixtures|mocks|testdata|stubs)(?:/|$)", path_lower))


def is_source_code(path: str) -> bool:
    if is_generated_or_data_file(path):
        return False
    suffix = PurePosixPath(path).suffix.lower()
    return suffix in SOURCE_CODE_EXTENSIONS


def is_maintainable_source_candidate(path: str) -> bool:
    """
    Checks if a file is an application source code file eligible for maintainability/architectural refactoring.
    Strictly excludes lockfiles, generated code, vendors, configuration files, and test fixtures.
    """
    if not is_source_code(path):
        return False
    if is_lockfile(path) or is_generated_or_data_file(path):
        return False
    if is_configuration_file(path) or is_test_or_fixture_file(path):
        return False
    return True


def language_for(path: str) -> str:
    return EXT_LANG.get(PurePosixPath(path).suffix.lower(), "Other")


def analyze_metrics(files: dict[str, str]) -> dict:
    languages = Counter()
    total_lines = 0
    total_code_lines = 0
    total_files = 0
    largest_all = []
    largest_sources = []
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

        largest_all.append((lines, path))
        if is_maintainable_source_candidate(path):
            largest_sources.append((lines, path))

        function_count += len(re.findall(r"\b(?:def|function|func)\s+[A-Za-z_][\w]*", content))
        class_count += len(re.findall(r"\bclass\s+[A-Za-z_][\w]*", content))
        normalized = "\n".join(line.strip() for line in content.splitlines() if line.strip())
        if len(normalized) >= 120 and is_source_code(path):
            hashes.setdefault(hashlib.sha1(normalized.encode()).hexdigest(), []).append(path)

    duplicates = [paths for paths in hashes.values() if len(paths) > 1]
    return {
        "total_files": total_files,
        "total_lines": total_lines,
        "code_lines": total_code_lines,
        "languages": dict(languages.most_common()),
        "functions": function_count,
        "classes": class_count,
        "largest_files": [{"path": p, "lines": n} for n, p in sorted(largest_all, reverse=True)[:8]],
        "largest_source_files": [{"path": p, "lines": n} for n, p in sorted(largest_sources, reverse=True)[:8]],
        "duplicate_groups": duplicates[:10],
    }
