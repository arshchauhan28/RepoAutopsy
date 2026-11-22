from __future__ import annotations

import re
from collections import defaultdict
from pathlib import PurePosixPath
from app.analyzers.dependencies import analyze_dependencies, JS_TS_EXTENSIONS
from app.analyzers.metrics import (
    is_lockfile,
    is_generated_or_data_file,
    is_configuration_file,
    is_maintainable_source_candidate,
)

# Common ecosystem technologies mapping
ECOSYSTEM_RULES = {
    "react": ("React", "frontend"),
    "next": ("Next.js", "frontend"),
    "vue": ("Vue.js", "frontend"),
    "svelte": ("Svelte", "frontend"),
    "tailwind": ("Tailwind CSS", "frontend"),
    "@xyflow/react": ("React Flow", "frontend"),
    "monaco-editor": ("Monaco Editor", "frontend"),
    "fastapi": ("FastAPI", "backend"),
    "flask": ("Flask", "backend"),
    "django": ("Django", "backend"),
    "express": ("Express", "backend"),
    "nest": ("NestJS", "backend"),
    "sqlalchemy": ("SQLAlchemy", "data"),
    "pydantic": ("Pydantic", "data"),
    "psycopg": ("PostgreSQL Driver", "data"),
    "pg": ("PostgreSQL Driver", "data"),
    "prisma": ("Prisma ORM", "data"),
    "mongoose": ("MongoDB Mongoose", "data"),
    "sqlite3": ("SQLite", "data"),
    "redis": ("Redis Client", "data"),
    "pytest": ("PyTest", "testing"),
    "jest": ("Jest", "testing"),
    "vitest": ("Vitest", "testing"),
    "openai": ("OpenAI SDK", "ai"),
    "anthropic": ("Anthropic SDK", "ai"),
    "groq": ("Groq SDK", "ai"),
    "langchain": ("LangChain", "ai"),
    "torch": ("PyTorch", "ai"),
    "tensorflow": ("TensorFlow", "ai"),
    "numpy": ("NumPy", "data"),
    "pandas": ("Pandas", "data"),
    "httpx": ("HTTPX", "network"),
    "axios": ("Axios", "network"),
    "uvicorn": ("Uvicorn ASGI", "backend"),
}

# Component classification patterns based on paths and semantics
COMPONENT_SIGNATURES = [
    {
        "id": "comp-api-routes",
        "name": "API Routes & Endpoints",
        "layer": "api",
        "role": "Handles HTTP requests, route matching, parameter validation and HTTP response mapping.",
        "patterns": [r"(?:^|/)(?:api|routes|endpoints|controllers|handlers)(?:/|$)", r"(?:^|/)(?:views|routers)\.py$"],
    },
    {
        "id": "comp-services",
        "name": "Business Logic & Services",
        "layer": "domain",
        "role": "Encapsulates application logic, workflows, domain rules, and orchestrates lower-level modules.",
        "patterns": [r"(?:^|/)(?:services|domain|usecases|managers|actions)(?:/|$)", r"(?:^|/)(?:service|logic)\.py$"],
    },
    {
        "id": "comp-data-models",
        "name": "Data Models & Storage",
        "layer": "data",
        "role": "Defines database schemas, ORM entities, validation schemas, and database connection lifecycle.",
        "patterns": [r"(?:^|/)(?:models|db|database|schemas|entities|migrations|prisma)(?:/|$)", r"(?:^|/)(?:model|schema|session|database)\.py$"],
    },
    {
        "id": "comp-auth-security",
        "name": "Auth & Security",
        "layer": "security",
        "role": "Manages user authentication, authorization checks, session tokens, and security policies.",
        "patterns": [r"(?:^|/)(?:auth|security|guards|oauth|jwt|permissions)(?:/|$)", r"(?:^|/)(?:auth|security)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-integrations",
        "name": "External Integrations & Clients",
        "layer": "integration",
        "role": "Communicates with third-party APIs, webhooks, LLM providers, and external services.",
        "patterns": [r"(?:^|/)(?:integrations|clients|adapters|webhooks|sdk)(?:/|$)", r"(?:^|/)(?:client|external|github_service|ai_service)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-frontend-pages",
        "name": "Frontend Pages & Routing",
        "layer": "presentation",
        "role": "Renders user-facing pages, handles client/server layout routing, and page transitions.",
        "patterns": [r"(?:^|/)(?:pages|app|routes)/(?:.*[A-Za-z0-9_-]+/page\.[a-z]+|.*\.(?:tsx|jsx|vue|svelte)$)", r"^frontend/app/.*page\.[a-z]+$"],
    },
    {
        "id": "comp-ui-components",
        "name": "Reusable UI Components",
        "layer": "presentation",
        "role": "Provides modular UI elements, design system components, cards, tables, and dialogs.",
        "patterns": [r"(?:^|/)(?:components|widgets|ui|views)/(?:.*)$", r"(?:^|/)components\.(?:tsx|jsx)$"],
    },
    {
        "id": "comp-core-utils",
        "name": "Core Config & Utilities",
        "layer": "infrastructure",
        "role": "Shared helper functions, environment configuration, formatters, and cross-cutting utilities.",
        "patterns": [r"(?:^|/)(?:utils|lib|common|helpers|core|config)(?:/|$)", r"(?:^|/)(?:config|settings|constants|utils)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-tests",
        "name": "Test Suite & Fixtures",
        "layer": "testing",
        "role": "Automated unit tests, integration tests, mock data, and test runner configurations.",
        "patterns": [r"(?:^|/)(?:tests|__tests__|spec|e2e|testing)(?:/|$)", r"(?:test_[^/]+\.py|.*\.test\.[a-z]+|.*\.spec\.[a-z]+)$"],
    },
    {
        "id": "comp-devops-infra",
        "name": "Deployment & Infrastructure",
        "layer": "infrastructure",
        "role": "Containerization, CI/CD pipelines, reverse proxy, build scripts, and cloud configurations.",
        "patterns": [r"(?:docker-compose.*|Dockerfile.*|\.github/.*|k8s/.*|render\.yaml|vercel\.json|nginx.*)$"],
    },
    {
        "id": "comp-config-env",
        "name": "Configuration & Tooling",
        "layer": "infrastructure",
        "role": "Project configuration, linters, compiler flags, and workspace settings.",
        "patterns": [r"(?:tsconfig.*|\.eslintrc.*|\.prettierrc.*|next\.config.*|tailwind\.config.*|vite\.config.*|postcss\.config.*|pyproject\.toml|setup\.cfg|\.env.*)$"],
    },
    {
        "id": "comp-docs-specs",
        "name": "Documentation & Specs",
        "layer": "general",
        "role": "Architecture documentation, API specifications, changelogs, and guides.",
        "patterns": [r"(?:^|/)(?:docs|documentation)/", r"\.(?:md|markdown|rst|txt)$", r"(?:README|LICENSE|CHANGELOG)"],
    },
]

SEMANTIC_RELATIONS: dict[tuple[str, str], str] = {
    ("comp-frontend-pages", "comp-ui-components"): "Renders UI",
    ("comp-frontend-pages", "comp-api-routes"): "Dispatches Requests",
    ("comp-frontend-pages", "comp-core-utils"): "Shared Utilities",
    ("comp-api-routes", "comp-services"): "Delegates Logic",
    ("comp-api-routes", "comp-auth-security"): "Guards Access",
    ("comp-api-routes", "comp-data-models"): "Validates Schemas",
    ("comp-services", "comp-data-models"): "Data Access",
    ("comp-services", "comp-integrations"): "External Services",
    ("comp-services", "comp-core-utils"): "Uses Utilities",
    ("comp-auth-security", "comp-data-models"): "User Storage",
    ("comp-tests", "comp-services"): "Unit Tests",
    ("comp-tests", "comp-api-routes"): "Integration Tests",
}


def classify_file_to_component(file_path: str) -> str:
    path_norm = str(PurePosixPath(file_path)).replace("\\", "/")
    if is_lockfile(path_norm) or is_generated_or_data_file(path_norm):
        return "comp-build-artifacts"

    for comp in COMPONENT_SIGNATURES:
        for pat in comp["patterns"]:
            if re.search(pat, path_norm, re.IGNORECASE):
                return comp["id"]
    return "comp-scripts-utils"


def build_nested_file_tree(files: dict[str, str]) -> dict:
    """
    Build a complete, deep hierarchical directory tree representing every analyzed file.
    """
    root = {
        "name": "root",
        "path": "",
        "type": "directory",
        "file_count": 0,
        "total_lines": 0,
        "total_size": 0,
        "children": {},
    }

    for path, content in sorted(files.items()):
        parts = PurePosixPath(path).parts
        curr = root
        file_lines = content.count("\n") + (1 if content else 0)
        file_size = len(content.encode("utf-8"))

        curr["file_count"] += 1
        curr["total_lines"] += file_lines
        curr["total_size"] += file_size

        for i, part in enumerate(parts):
            is_file = i == len(parts) - 1
            if is_file:
                ext = PurePosixPath(part).suffix.lower()
                curr["children"][part] = {
                    "name": part,
                    "path": path,
                    "type": "file",
                    "extension": ext,
                    "lines": file_lines,
                    "size": file_size,
                }
            else:
                if part not in curr["children"]:
                    sub_path = "/".join(parts[: i + 1])
                    curr["children"][part] = {
                        "name": part,
                        "path": sub_path,
                        "type": "directory",
                        "file_count": 0,
                        "total_lines": 0,
                        "total_size": 0,
                        "children": {},
                    }
                curr = curr["children"][part]
                curr["file_count"] += 1
                curr["total_lines"] += file_lines
                curr["total_size"] += file_size

    def format_node(node: dict) -> dict:
        if node["type"] == "file":
            return node
        sorted_children = sorted(
            node["children"].values(),
            key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()),
        )
        return {
            "name": node["name"],
            "path": node["path"],
            "type": "directory",
            "file_count": node["file_count"],
            "total_lines": node["total_lines"],
            "total_size": node["total_size"],
            "children": [format_node(c) for c in sorted_children],
        }

    return format_node(root)


def analyze_architecture(files: dict[str, str]) -> dict:
    """
    Analyze codebase architecture with 3 comprehensive representations:
    1. Architectural components & relationships
    2. Deep file hierarchy
    3. Module dependency graph
    """
    # 1. Dependency Graph
    dep_data = analyze_dependencies(files)

    # 2. Component categorization
    components_map: dict[str, dict] = {}
    sig_lookup = {c["id"]: c for c in COMPONENT_SIGNATURES}

    file_to_comp: dict[str, str] = {}
    for path, content in files.items():
        comp_id = classify_file_to_component(path)
        file_to_comp[path] = comp_id
        if comp_id not in components_map:
            sig = sig_lookup.get(
                comp_id,
                {
                    "id": comp_id,
                    "name": "Root Scripts & Utilities",
                    "layer": "infrastructure",
                    "role": "Project-level helper scripts and miscellaneous source files.",
                },
            )
            components_map[comp_id] = {
                "id": sig["id"],
                "name": sig["name"],
                "layer": sig["layer"],
                "role": sig["role"],
                "file_count": 0,
                "total_lines": 0,
                "technologies": set(),
                "files": [],
            }
        lines = content.count("\n") + (1 if content else 0)
        components_map[comp_id]["file_count"] += 1
        # Exclude lockfiles from dominating architectural line counts
        if not is_lockfile(path):
            components_map[comp_id]["total_lines"] += lines
        components_map[comp_id]["files"].append({"path": path, "lines": lines})

    # Detect technologies in each component
    ecosystem_set: set[str] = set()
    for edge in dep_data["edges"]:
        import_name = (edge.get("import_name") or "").lower()
        for rule_key, (tech_label, _cat) in ECOSYSTEM_RULES.items():
            if rule_key in import_name:
                ecosystem_set.add(tech_label)
                src_comp = file_to_comp.get(edge["source"])
                if src_comp and src_comp in components_map:
                    components_map[src_comp]["technologies"].add(tech_label)

    # Detect technologies from package / requirements files
    for path, content in files.items():
        path_lower = path.lower()
        if "package.json" in path_lower or "requirements.txt" in path_lower:
            comp_id = file_to_comp.get(path, "comp-core-utils")
            for rule_key, (tech_label, _cat) in ECOSYSTEM_RULES.items():
                if rule_key in content.lower():
                    ecosystem_set.add(tech_label)
                    if comp_id in components_map:
                        components_map[comp_id]["technologies"].add(tech_label)

    # 3. Inter-component edges based on real module import edges
    comp_edge_weights: dict[tuple[str, str], int] = defaultdict(int)
    for edge in dep_data["edges"]:
        if edge.get("is_external"):
            continue
        src = edge["source"]
        tgt = edge["target"]
        src_comp = file_to_comp.get(src)
        tgt_comp = file_to_comp.get(tgt)
        if src_comp and tgt_comp and src_comp != tgt_comp:
            comp_edge_weights[(src_comp, tgt_comp)] += 1

    # Format Overview Nodes & Edges for React Flow
    layer_order = {
        "presentation": 0,
        "api": 1,
        "domain": 2,
        "security": 2,
        "integration": 3,
        "data": 4,
        "infrastructure": 5,
        "testing": 6,
        "general": 7,
    }

    # Filter out pure build artifacts (lockfiles) from dominating primary overview
    active_components = [
        c for c in components_map.values()
        if c["id"] != "comp-build-artifacts" or len(components_map) <= 1
    ]
    active_components = sorted(
        active_components,
        key=lambda c: (layer_order.get(c["layer"], 9), -c["file_count"]),
    )

    overview_nodes = []
    for c in active_components:
        overview_nodes.append({
            "id": c["id"],
            "label": c["name"],
            "type": "componentNode",
            "layer": c["layer"],
            "role": c["role"],
            "file_count": c["file_count"],
            "total_lines": c["total_lines"],
            "technologies": sorted(c["technologies"]),
            "sample_files": [f["path"] for f in c["files"][:8]],
        })

    active_ids = {c["id"] for c in active_components}
    overview_edges = []
    for (src_c, tgt_c), weight in comp_edge_weights.items():
        if src_c in active_ids and tgt_c in active_ids:
            rel_label = SEMANTIC_RELATIONS.get((src_c, tgt_c))
            edge_label = f"{rel_label} ({weight})" if rel_label else f"{weight} link{'s' if weight > 1 else ''}"
            overview_edges.append({
                "id": f"comp_edge_{src_c}_{tgt_c}",
                "source": src_c,
                "target": tgt_c,
                "label": edge_label,
                "weight": weight,
                "animated": True,
            })

    # If components have no inter-imports (e.g. static site or separated apps), infer natural flow
    if not overview_edges and len(overview_nodes) > 1:
        comp_ids = {c["id"] for c in active_components}
        inferred = [
            ("comp-frontend-pages", "comp-ui-components"),
            ("comp-frontend-pages", "comp-api-routes"),
            ("comp-api-routes", "comp-services"),
            ("comp-services", "comp-data-models"),
            ("comp-api-routes", "comp-data-models"),
            ("comp-services", "comp-integrations"),
            ("comp-api-routes", "comp-auth-security"),
        ]
        for src, tgt in inferred:
            if src in comp_ids and tgt in comp_ids:
                rel_label = SEMANTIC_RELATIONS.get((src, tgt), "inferred flow")
                overview_edges.append({
                    "id": f"inferred_{src}_{tgt}",
                    "source": src,
                    "target": tgt,
                    "label": rel_label,
                    "weight": 1,
                    "animated": False,
                })

    # 4. Complete nested file tree
    file_hierarchy = build_nested_file_tree(files)

    # 5. Top-level folders for backward compatibility
    top_counts = defaultdict(int)
    for p in files.keys():
        parts = PurePosixPath(p).parts
        root_folder = parts[0] if len(parts) > 1 else "root"
        top_counts[root_folder] += 1

    # Legacy nodes & edges for backward compatibility
    legacy_nodes = [{"id": "root", "label": "Repository", "type": "root"}]
    legacy_edges = []
    for i, (folder, count) in enumerate(sorted(top_counts.items(), key=lambda x: -x[1])[:12]):
        nid = f"folder-{i}"
        legacy_nodes.append({"id": nid, "label": folder, "type": "folder", "files": count})
        legacy_edges.append({"source": "root", "target": nid})

    # Structure summary for diagnostics, drill-down & AI review
    incoming_map = defaultdict(list)
    outgoing_map = defaultdict(list)
    for (src, tgt), w in comp_edge_weights.items():
        if src in active_ids and tgt in active_ids:
            outgoing_map[src].append({"component_id": tgt, "weight": w})
            incoming_map[tgt].append({"component_id": src, "weight": w})

    components_summary = [
        {
            "id": c["id"],
            "name": c["name"],
            "layer": c["layer"],
            "file_count": c["file_count"],
            "total_lines": c["total_lines"],
            "technologies": sorted(c["technologies"]),
            "role": c["role"],
            "files": [{"path": f["path"], "lines": f["lines"]} for f in c["files"]],
            "sample_files": [f["path"] for f in c["files"][:10]],
            "incoming_connections": incoming_map.get(c["id"], []),
            "outgoing_connections": outgoing_map.get(c["id"], []),
        }
        for c in active_components
    ]

    return {
        # Rich architecture representations
        "components": components_summary,
        "overview_nodes": overview_nodes,
        "overview_edges": overview_edges,
        "dependency_graph": dep_data,
        "file_hierarchy": file_hierarchy,
        # Backward compatibility
        "nodes": legacy_nodes,
        "edges": legacy_edges,
        "top_level": dict(top_counts),
        "ecosystem": sorted(ecosystem_set),
    }
