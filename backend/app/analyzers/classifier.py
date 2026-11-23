from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Literal

FileTypeCategory = Literal[
    "application_source",
    "test",
    "configuration",
    "documentation",
    "asset",
    "generated_code",
    "vendored_dependency",
    "build_output",
    "infrastructure",
    "unknown",
]

LanguageSupportTier = Literal[
    "fully_parsed",
    "partially_supported",
    "inventory_only",
]

LANGUAGE_TIERS: dict[str, LanguageSupportTier] = {
    "Python": "fully_parsed",
    "JavaScript": "fully_parsed",
    "TypeScript": "fully_parsed",
    "JSON": "partially_supported",
    "YAML": "partially_supported",
    "HTML": "partially_supported",
    "CSS": "partially_supported",
    "SCSS": "partially_supported",
    "SQL": "partially_supported",
    "Shell": "partially_supported",
    "Markdown": "partially_supported",
    "Java": "inventory_only",
    "Go": "inventory_only",
    "Rust": "inventory_only",
    "C++": "inventory_only",
    "C": "inventory_only",
    "C#": "inventory_only",
    "PHP": "inventory_only",
    "Ruby": "inventory_only",
    "Kotlin": "inventory_only",
    "Swift": "inventory_only",
}

EXT_TO_LANGUAGE: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SCSS",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".md": "Markdown",
    ".markdown": "Markdown",
    ".rst": "Documentation",
    ".txt": "Documentation",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".c": "C",
    ".h": "C",
    ".hpp": "C++",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".kt": "Kotlin",
    ".swift": "Swift",
}

VENDORED_DIR_NAMES = {
    "node_modules", "vendor", "third_party", ".venv", "venv", "env",
    "site-packages", "bower_components", "packages",
}

BUILD_OUTPUT_DIR_NAMES = {
    "dist", "build", ".next", "out", "target", "__pycache__", ".cache",
    ".parcel-cache", ".turbo", "coverage", ".pytest_cache", ".nyc_output",
}

LOCKFILE_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "cargo.lock", "gemfile.lock", "composer.lock", "mix.lock",
    "pipfile.lock", "flake.lock", "pubspec.lock", "packages.lock.json",
}

GENERATED_FILE_NAMES = {
    "bundle.js", "vendor.js", "main.bundle.js", "runtime.js",
}

GENERATED_FILE_EXTENSIONS = {
    ".min.js", ".min.css", ".map", ".bundle.js", ".bundle.css",
    ".chunk.js", ".chunk.css", ".wasm", ".bin",
}

CONFIG_FILENAMES = {
    "package.json", "tsconfig.json", "jsconfig.json", "pyproject.toml",
    "setup.cfg", "setup.py", "requirements.txt", "requirements-dev.txt",
    "pom.xml", "build.gradle", "settings.gradle", "cargo.toml",
    ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
    ".prettierrc", ".prettierrc.json", ".prettierrc.js",
    "tailwind.config.js", "tailwind.config.ts", "postcss.config.js",
    "next.config.js", "next.config.ts", "next.config.mjs",
    "vite.config.js", "vite.config.ts", "webpack.config.js",
    "babel.config.js", ".babelrc", ".gitignore", ".gitattributes",
    ".editorconfig", "pytest.ini", "tox.ini", ".env.example",
}

INFRASTRUCTURE_PATTERNS = [
    r"^\.github/(?:workflows|actions)/",
    r"^\.gitlab-ci\.yml$",
    r"^docker-compose.*\.ya?ml$",
    r"^Dockerfile.*$",
    r"^k8s/.*",
    r"^helm/.*",
    r"^terraform/.*",
    r"^render\.yaml$",
    r"^vercel\.json$",
    r"^netlify\.toml$",
    r"^Procfile$",
]

TEST_PATTERNS = [
    r"(?:^|/)(?:tests?|__tests__|spec|specs|e2e|testdata|stubs|mocks|fixtures)(?:/|$)",
    r"(?:test_[^/]+\.py|.*_test\.py|.*\.test\.[a-z]+|.*\.spec\.[a-z]+)$",
]

DOC_PATTERNS = [
    r"(?:^|/)(?:docs|documentation|guides|specifications)(?:/|$)",
    r"^(?:README|LICENSE|CHANGELOG|CONTRIBUTING|CODE_OF_CONDUCT|AUTHORS)(?:\.[a-z]+)?$",
    r"\.(?:md|markdown|rst|txt)$",
]

ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".pdf",
}

SOURCE_CODE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
    ".java", ".go", ".rs", ".cpp", ".cc", ".c", ".cs", ".php",
    ".rb", ".kt", ".swift", ".sql", ".sh",
}


def classify_file(path: str) -> FileTypeCategory:
    """
    Deterministically classifies a repository file path into one of 10 canonical categories.
    Uses path structure, directory ancestry, framework conventions, and extensions.
    """
    posix_path = PurePosixPath(path)
    parts_lower = [p.lower() for p in posix_path.parts]
    name_lower = posix_path.name.lower()
    path_str = str(posix_path).replace("\\", "/")

    # 1. Vendored dependencies
    if any(p in VENDORED_DIR_NAMES for p in parts_lower):
        return "vendored_dependency"

    # 2. Build output
    if any(p in BUILD_OUTPUT_DIR_NAMES for p in parts_lower):
        return "build_output"

    # 3. Generated code & lockfiles
    if name_lower in LOCKFILE_NAMES or name_lower.endswith(".lock"):
        return "generated_code"
    if name_lower in GENERATED_FILE_NAMES or name_lower.startswith("bundle."):
        return "generated_code"
    if any(path_str.endswith(ext) for ext in GENERATED_FILE_EXTENSIONS):
        return "generated_code"
    if ".min." in name_lower or ".bundle." in name_lower or ".chunk." in name_lower:
        return "generated_code"

    # 4. Configuration
    if name_lower in CONFIG_FILENAMES or name_lower.startswith(".env."):
        return "configuration"
    if posix_path.suffix.lower() in {".toml", ".ini", ".cfg", ".conf"}:
        return "configuration"

    # 5. Infrastructure & CI/CD
    if any(re.search(pat, path_str, re.IGNORECASE) for pat in INFRASTRUCTURE_PATTERNS):
        return "infrastructure"

    # 6. Tests
    if any(re.search(pat, path_str, re.IGNORECASE) for pat in TEST_PATTERNS):
        return "test"

    # 7. Documentation
    if any(re.search(pat, path_str, re.IGNORECASE) for pat in DOC_PATTERNS):
        return "documentation"

    # 8. Assets
    if posix_path.suffix.lower() in ASSET_EXTENSIONS:
        return "asset"

    # 9. Application Source
    if posix_path.suffix.lower() in SOURCE_CODE_EXTENSIONS:
        return "application_source"

    # 10. Check JSON/YAML non-config as asset/data or config
    if posix_path.suffix.lower() in {".json", ".yaml", ".yml"}:
        return "configuration"

    return "unknown"


def get_file_language(path: str) -> str:
    """Returns detected language name or 'Other'."""
    suffix = PurePosixPath(path).suffix.lower()
    return EXT_TO_LANGUAGE.get(suffix, "Other")


def get_language_support_tier(language: str) -> LanguageSupportTier:
    """Returns whether a language has full AST parser, partial heuristics, or inventory only."""
    return LANGUAGE_TIERS.get(language, "inventory_only")


def is_eligible_for_ast_parsing(path: str, category: FileTypeCategory) -> bool:
    """
    Returns True if the file should undergo full AST extraction (classes, functions, imports, syntax).
    Excludes vendored dependencies, build outputs, generated bundles, and non-source files.
    """
    if category in {"vendored_dependency", "build_output", "generated_code", "asset", "documentation"}:
        return False
    suffix = PurePosixPath(path).suffix.lower()
    return suffix in {".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}
