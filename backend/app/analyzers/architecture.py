import re
from pathlib import PurePosixPath
from collections import defaultdict

IMPORT_PATTERNS = [
    re.compile(r"^\s*import\s+([A-Za-z_][\w.]*)", re.M),
    re.compile(r"^\s*from\s+([A-Za-z_][\w.]*)\s+import", re.M),
    re.compile(r"require\(['\"]([^'\"]+)", re.M),
    re.compile(r"from\s+['\"]([^'\"]+)['\"]", re.M),
]


def analyze_architecture(files: dict[str, str]) -> dict:
    top = defaultdict(int)
    imports = defaultdict(set)
    for path, content in files.items():
        parts = PurePosixPath(path).parts
        root = parts[0] if len(parts) > 1 else "root"
        top[root] += 1
        for pattern in IMPORT_PATTERNS:
            for match in pattern.findall(content):
                dep = match[0] if isinstance(match, tuple) else match
                if dep and not dep.startswith("."):
                    imports[root].add(dep.split(".")[0].split("/")[0])

    nodes = [{"id": "root", "label": "Repository", "type": "root"}]
    edges = []
    for i, (folder, count) in enumerate(sorted(top.items(), key=lambda x: -x[1])[:12]):
        node_id = f"folder-{i}"
        nodes.append({"id": node_id, "label": folder, "type": "folder", "files": count})
        edges.append({"source": "root", "target": node_id})

    ecosystem = []
    all_imports = {x for values in imports.values() for x in values}
    known = {
        "react": "React", "next": "Next.js", "fastapi": "FastAPI", "flask": "Flask", "django": "Django",
        "express": "Express", "axios": "Axios", "sqlalchemy": "SQLAlchemy", "pydantic": "Pydantic",
        "numpy": "NumPy", "pandas": "Pandas", "torch": "PyTorch", "tensorflow": "TensorFlow",
    }
    for dep, label in known.items():
        if dep in {x.lower() for x in all_imports}:
            ecosystem.append(label)

    return {"nodes": nodes, "edges": edges, "top_level": dict(top), "ecosystem": ecosystem}
